const fs = require('node:fs');
const esbuild = require('esbuild');

/**
 * Builds the samples app (samples/demo) once into ./dist_demo as a static site.
 * This is what the "demo" github action publishes to the gh-pages branch.
 * `npm start` serves the same app with hot reload while working on it.
 *
 * Output:
 * - index.js   the app, minified, with a sourcemap so it can be debugged in the browser
 * - index.css  esbuild writes the css the app imports next to the js
 * - index.html
 * - .nojekyll  github pages serves the folder as it is, without running jekyll on it
 */

const OUT_DIR = './dist_demo';

// relative paths, github pages serves a project site from /<repo>/ and not from /
// defer, the app adds itself to document.body as soon as it runs
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>@simple-html/grid - samples</title>
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
        logLevel: 'info'
    });

    fs.writeFileSync(`${OUT_DIR}/index.html`, INDEX_HTML);
    fs.writeFileSync(`${OUT_DIR}/.nojekyll`, '');
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
