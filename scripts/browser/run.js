// The browser checks: every script in scripts/browser/checks/ drives the docs site (dist_demo, built by
// `npm run build:demo`) in a real Chromium and prints a line per check, PASS or FAIL. This serves the site,
// runs the scripts a few at a time and sums up: exit code 0 when every script ran to its end with no FAIL.
//
// Usage: npm run check:browser [-- --only <part of a file name>] [--jobs <n>]
// Env:   CHROMIUM_PATH  a Chromium to use (else playwright's own: `npx playwright install chromium`)
//        PORT           the port the site is served on, default 8090
//        SHOTS          where the scripts put their screenshots, default a folder in the temp dir
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const SITE = path.resolve(__dirname, '../../dist_demo');
const CHECKS = path.resolve(__dirname, 'checks');
const PORT = Number(process.env.PORT || 8090);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'simple-html-browser-shots');
/** a script that has not ended after this is stopped, and fails */
const TIMEOUT_MS = 180_000;

const TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.map': 'application/json'
};

/** the value of a flag: `--only fill` */
function flag(name, fallback) {
    const at = process.argv.indexOf(`--${name}`);
    return at === -1 ? fallback : process.argv[at + 1];
}

/** serves the built site, nothing outside it */
function serve() {
    const server = http.createServer((request, response) => {
        const url = decodeURIComponent((request.url || '/').split('?')[0]);
        let file = path.join(SITE, url);
        if (!file.startsWith(SITE)) {
            response.writeHead(403);
            response.end();
            return;
        }
        if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
            file = path.join(file, 'index.html');
        }
        fs.readFile(file, (error, data) => {
            if (error) {
                response.writeHead(404);
                response.end();
                return;
            }
            response.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
            response.end(data);
        });
    });
    return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

/** runs one script: its output, its exit code, its PASS and FAIL lines */
function run(file) {
    return new Promise((resolve) => {
        const started = Date.now();
        const child = spawn(process.execPath, [path.join(CHECKS, file), `http://127.0.0.1:${PORT}/`, SHOTS], {
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let output = '';
        child.stdout.on('data', (data) => {
            output += data;
        });
        child.stderr.on('data', (data) => {
            output += data;
        });
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            child.kill('SIGKILL');
        }, TIMEOUT_MS);
        child.on('close', (code) => {
            clearTimeout(timer);
            const passed = (output.match(/^PASS/gm) || []).length;
            const failed = (output.match(/^FAIL/gm) || []).length;
            const ok = code === 0 && !timedOut && failed === 0 && passed > 0;
            resolve({ file, ok, code, timedOut, passed, failed, output, seconds: Math.round((Date.now() - started) / 1000) });
        });
    });
}

async function main() {
    if (!fs.existsSync(path.join(SITE, 'index.html'))) {
        console.error('dist_demo is not built: npm run build:demo first');
        process.exit(1);
    }
    fs.mkdirSync(SHOTS, { recursive: true });
    const only = flag('only', '');
    const jobs = Math.max(1, Number(flag('jobs', '2')));
    const files = fs
        .readdirSync(CHECKS)
        .filter((file) => file.endsWith('.js') && file.includes(only))
        .sort();
    if (!files.length) {
        console.error(`no check matches "${only}"`);
        process.exit(1);
    }

    const server = await serve();
    const results = [];
    const queue = [...files];
    const worker = async () => {
        while (queue.length) {
            const result = await run(queue.shift());
            results.push(result);
            const verdict = result.ok ? 'PASS' : 'FAIL';
            const why = result.timedOut ? ', timed out' : result.code !== 0 ? `, exit ${result.code}` : '';
            console.log(
                `${verdict}  ${result.file}  ${result.passed} passed, ${result.failed} failed${why}  (${result.seconds}s)`
            );
        }
    };
    await Promise.all(Array.from({ length: Math.min(jobs, files.length) }, worker));
    server.close();

    const failed = results.filter((result) => !result.ok);
    for (const result of failed) {
        console.log(`\n=== ${result.file}\n${result.output.trim()}`);
    }
    console.log(
        failed.length
            ? `\n${failed.length} of ${results.length} failed: ${failed.map((result) => result.file).join(', ')}`
            : `\nall ${results.length} passed`
    );
    process.exit(failed.length ? 1 : 0);
}

main();
