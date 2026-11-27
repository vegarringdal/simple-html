const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

/**
 * Runs the checks of GitHub Actions (.github/workflows/checks.yml) here, before a push - the same
 * commands, read from the workflow: they can not drift apart. Every check runs, as the workflow's jobs do
 * (one failing does not stop the others), then a summary; the exit code is 1 when one failed. The
 * pre-push hook (.githooks/pre-push) runs it: a push of a commit that fails a check is stopped here, not
 * on GitHub.
 *
 * Usage: npm run verify            every check
 *        npm run verify -- vitest  the checks whose command has `vitest` in it
 */

/**
 * The commands of the workflow's matrix (`matrix.check`), in their order. Read as text: the file is
 * small and its shape is known - a list under `matrix:` › `check:`, an item per line
 * @param text the workflow, checks.yml
 */
function checksOf(text) {
    const lines = text.split(/\r?\n/);
    // the `check:` under `matrix:` - the job is called check too
    const matrix = lines.findIndex((line) => /^\s*matrix:\s*$/.test(line));
    const start = matrix === -1 ? -1 : lines.findIndex((line, index) => index > matrix && /^\s*check:\s*$/.test(line));
    if (start === -1) {
        throw new Error('checks.yml: no matrix `check:` list');
    }
    const indent = (line) => line.length - line.trimStart().length;
    const own = indent(lines[start]);
    const checks = [];
    for (const line of lines.slice(start + 1)) {
        if (line.trim() === '' || line.trim().startsWith('#')) {
            continue;
        }
        if (indent(line) <= own) {
            break;
        }
        const item = /^\s*-\s+(.+?)\s*$/.exec(line);
        if (!item) {
            break;
        }
        checks.push(item[1].replace(/^(['"])(.*)\1$/, '$2'));
    }
    if (!checks.length) {
        throw new Error('checks.yml: the matrix `check:` list is empty');
    }
    return checks;
}

function run() {
    const root = path.join(__dirname, '..');
    const workflow = fs.readFileSync(path.join(root, '.github/workflows/checks.yml'), 'utf8');
    const filter = process.argv.slice(2).join(' ').trim();
    const checks = checksOf(workflow).filter((check) => !filter || check.includes(filter));
    const results = [];
    for (const check of checks) {
        console.log(`\n=== ${check}`);
        const started = Date.now();
        const { status } = spawnSync(check, { cwd: root, shell: true, stdio: 'inherit' });
        results.push({ check, ok: status === 0, seconds: Math.round((Date.now() - started) / 1000) });
    }
    console.log('\n=== verify: the checks of checks.yml');
    for (const { check, ok, seconds } of results) {
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${check}  (${seconds}s)`);
    }
    const failed = results.filter((result) => !result.ok).length;
    console.log(failed ? `${failed} of ${results.length} failed - not ready to push` : `all ${results.length} passed`);
    process.exit(failed ? 1 : 0);
}

if (require.main === module) {
    run();
}

module.exports = { checksOf };
