const fs = require('node:fs');
const path = require('node:path');
const { GUIDES_DIR, renderGuides, USER_GUIDE_DIR } = require('./guides');
const { readApiModel } = require('./api');
const { readStatus } = require('./status');

/**
 * esbuild plugin for the docs site (samples/demo), used by scripts/buildDemo.js and the dev server.
 * samples/demo/docs.d.ts has the types of what it gives.
 *
 * - `import source from './file.ts?raw'`  the text of the file, the samples show their own source
 * - `import guides from 'docs:guides'`     guides/*.md rendered to html, see guides.js.
 *                                          docsPlugin({ guidesDir }) reads another folder
 * - `import userGuide from 'docs:user-guide'` user-guide/*.md, the guide for the people using a grid:
 *                                          the same, its links to #user-guide/..
 * - `import api from 'docs:api'`           the API pages, from typedoc, see api.js
 * - `import status from 'docs:status'`     what the site is built from (branch, commit) and the work
 *                                          in progress page, from V6_PLAN.md and IMPORVEMENT.md, see status.js
 */
function docsPlugin({ guidesDir = GUIDES_DIR, userGuideDir = USER_GUIDE_DIR } = {}) {
    return {
        name: 'docs',
        setup(build) {
            build.onResolve({ filter: /\?raw$/ }, (args) => ({
                path: path.resolve(args.resolveDir, args.path.slice(0, -'?raw'.length)),
                namespace: 'raw'
            }));
            build.onLoad({ filter: /.*/, namespace: 'raw' }, (args) => ({
                contents: fs.readFileSync(args.path, 'utf8'),
                loader: 'text',
                watchFiles: [args.path]
            }));

            build.onResolve({ filter: /^docs:(guides|user-guide|api|status)$/ }, (args) => ({
                path: args.path,
                namespace: 'docs'
            }));
            build.onLoad({ filter: /.*/, namespace: 'docs' }, async (args) => {
                const data =
                    args.path === 'docs:guides'
                        ? renderGuides(guidesDir)
                        : args.path === 'docs:user-guide'
                          ? renderGuides(userGuideDir, 'user-guide')
                          : args.path === 'docs:status'
                            ? readStatus()
                            : await readApiModel();
                return { contents: JSON.stringify(data), loader: 'json' };
            });
        }
    };
}

module.exports = { docsPlugin };
