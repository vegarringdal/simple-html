import { addDefaultIndex, client, TypeChecker } from 'esbuild-helpers';
// the guides, the API pages and the sources of the samples of the docs site (samples/demo)
import { docsPlugin } from './scripts/site/esbuildPlugin';

/**
 * Local dev server: builds a sample, serves it on 8080 with hot reload, and runs a
 * background typechecker over src + samples.
 *
 * `npm start` -> demo, `npm start <sample>` for another folder under samples/.
 * Output is throwaway and gitignored (dist_dev).
 *
 * PORT env overrides the dev server port (hot reload websocket uses PORT+1),
 * e.g. `PORT=8090 npm start demo` to run next to another instance on 8080.
 */

const sample = process.argv[2] || 'demo';
const OUTPUT_ROOT = 'dist_dev';
const PORT = Number(process.env.PORT) || 8080;

client(
    { watch: [`./samples/${sample}/**/*.*`, './src/**/*.*', './guides/**/*.*'] },
    {
        color: true,
        define: {
            DEVELOPMENT: 'true'
        },
        entryPoints: [`./samples/${sample}/index.ts`],
        outfile: `./${OUTPUT_ROOT}/${sample}/index.js`,
        minify: false,
        bundle: true,
        tsconfig: './samples/tsconfig.json',
        platform: 'browser',
        sourcemap: true,
        plugins: [docsPlugin()],
        logLevel: 'error'
    }
);

addDefaultIndex({
    distFolder: `${OUTPUT_ROOT}/${sample}`,
    publicFolders: [],
    entry: './index.js',
    hbr: true,
    devServer: true,
    devServerPort: PORT,
    webSocketPort: PORT + 1,
    userInjectOnHbr: 'window.location.reload();',
    indexTemplate: /*html*/ `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>@simple-html/grid</title>
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M1 1h14v14H1z' fill='none' stroke='%23334' stroke-width='2'/%3E%3Cpath d='M1 6h14M1 11h14M6 1v14' stroke='%23334'/%3E%3C/svg%3E" />
        <link href="./index.css" rel="stylesheet" />


        $bundle
      </head>
      <body>
      </body>
      </html>
      `
});

const checker_client = TypeChecker({
    basePath: './',
    name: 'checker_client',
    tsConfigJsonContent: {
        compilerOptions: {
            target: 'es2025',
            module: 'esNext',
            lib: ['es2025', 'dom'],
            moduleResolution: 'bundler',
            isolatedModules: false,
            preserveConstEnums: true,
            allowSyntheticDefaultImports: true,
            skipLibCheck: true,
            sourceMap: true,
            inlineSources: true,
            declaration: true,
            noImplicitAny: true,
            noImplicitReturns: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true,
            noImplicitThis: false,
            noUnusedLocals: true,
            allowUnreachableCode: false,
            removeComments: true,
            emitDecoratorMetadata: false,
            importHelpers: false,
            strict: true,
            experimentalDecorators: true,
            rootDir: '',
            paths: {
                '@simple-html/grid': ['./src'],
                '@simple-html/grid/sql': ['./src/sql.ts']
            }
        },
        // node scripts have no business in a browser typecheck, and build output is not source
        exclude: ['node_modules', 'config_devserver.ts', 'dist', 'dist_dev', 'docs']
    }
});

checker_client.printSettings();
checker_client.inspectAndPrint();
checker_client.worker_watch(['./samples', './src']);
