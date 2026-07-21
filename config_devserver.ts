import { addDefaultIndex, clearFolders, client, TypeChecker } from 'esbuild-helpers';

/**
 * Local dev server: builds a sample, serves it on 8080 with hot reload, and runs a
 * background typechecker over src + samples.
 *
 * `npm start` -> grid01, `npm start <sample>` for another folder under samples/.
 * Output is throwaway and gitignored (dist_dev).
 */

const sample = process.argv[2] || 'grid01';
const OUTPUT_ROOT = 'dist_dev';

clearFolders('dist_client', 'dist_nodejs');

client(
    { watch: [`./samples/${sample}/**/*.*`, './src/**/*.*'] },
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
        logLevel: 'error'
    }
);

addDefaultIndex({
    distFolder: `${OUTPUT_ROOT}/${sample}`,
    publicFolders: [],
    entry: './index.js',
    hbr: true,
    devServer: true,
    devServerPort: 8080,
    userInjectOnHbr: 'window.location.reload();',
    indexTemplate: /*html*/ `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Document</title>
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
            strictNullChecks: false,
            experimentalDecorators: true,
            rootDir: '',
            paths: {
                '@simple-html/grid': ['./src']
            }
        },
        // node scripts have no business in a browser typecheck, and build output is not source
        exclude: ['node_modules', 'config_devserver.ts', 'dist', 'dist_dev', 'docs']
    }
});

checker_client.printSettings();
checker_client.inspectAndPrint();
checker_client.worker_watch(['./samples', './src']);
