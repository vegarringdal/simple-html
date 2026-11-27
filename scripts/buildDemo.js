const fs = require('node:fs');
const esbuild = require('esbuild');
const { docsPlugin } = require('./site/esbuildPlugin');
const { buildInfo } = require('./site/status');

/**
 * Builds the docs site (samples/demo: guides, samples and API pages) once into ./dist_demo as a
 * static site. This is what the "pages" github action publishes to the gh-pages branch.
 * `npm start` serves the same app with hot reload while working on it.
 *
 * `node scripts/buildDemo.js <folder>` builds into another folder, the smoke test of the site
 * (samples/demo/__tests__/site.test.ts) does that.
 *
 * Output:
 * - index.js   the app, minified, with a sourcemap so it can be debugged in the browser.
 *              The guides and the API model are in it, see scripts/site/esbuildPlugin.js
 * - index.css  esbuild writes the css the app imports next to the js
 * - index.html
 * - .nojekyll  github pages serves the folder as it is, without running jekyll on it
 * - build.json what it is built from (scripts/site/status.js buildInfo): the list of dev/ on gh-pages
 *              reads it (scripts/pages.js)
 */

const OUT_DIR = process.argv[2] || './dist_demo';

// relative paths, github pages serves a project site from /<repo>/ and not from /
// defer, the app adds itself to document.body as soon as it runs
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>@simple-html/grid</title>
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M1 1h14v14H1z' fill='none' stroke='%23334' stroke-width='2'/%3E%3Cpath d='M1 6h14M1 11h14M6 1v14' stroke='%23334'/%3E%3C/svg%3E" />
        <link href="./index.css" rel="stylesheet" />
        <script defer src="./index.js"></script>
    </head>
    <body></body>
</html>
`;

async function run() {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });

    await esbuild.build({
        entryPoints: ['./samples/demo/index.ts'],
        outfile: `${OUT_DIR}/index.js`,
        bundle: true,
        minify: true,
        sourcemap: true,
        platform: 'browser',
        // its paths map @simple-html/grid to ./src, same as the dev server
        tsconfig: './samples/tsconfig.json',
        plugins: [docsPlugin()],
        logLevel: 'info'
    });

    fs.writeFileSync(`${OUT_DIR}/index.html`, INDEX_HTML);
    fs.writeFileSync(`${OUT_DIR}/.nojekyll`, '');
    fs.writeFileSync(`${OUT_DIR}/build.json`, `${JSON.stringify(buildInfo(), null, 4)}\n`);
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
