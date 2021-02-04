import { clearFolders, addDefaultIndex, client, postcssPlugin, single } from 'esbuild-helpers';
import { TypeChecker } from 'fuse-box-typechecker';

clearFolders('dist_client', 'dist_nodejs');

const sample = process.argv[2];


/**
 * css so we dont need to wait for postcss unless we change css..
 */
single(
    { watch: `./src/${sample}/**/*.css` },
    {
        color: true,
        define: {
            DEVELOPMENT: 'true'
        },
        entryPoints: [`./samples/${sample}/index.css`],
        outfile: `./dist/${sample}/app.css`,
        plugins: [postcssPlugin([require('tailwindcss')])],
        logLevel: 'error',
        incremental: true
    }
);

/**
 * client bundle
 */
client(
    { watch: [`./samples/${sample}/**/*.ts`, './packages/**/*.*'] },
    {
        color: true,
        define: {
            DEVELOPMENT: 'true'
        },
        entryPoints: [`./samples/${sample}/index.ts`],
        outfile: `./dist/${sample}/index.js`,
        minify: false,
        bundle: true,
        tsconfig: './samples/tsconfig.json',
        platform: 'browser',
        sourcemap: true,
        logLevel: 'error',
        incremental: true
    }
);

/**
 * index file for project
 */
addDefaultIndex({
    distFolder: `dist/${sample}`,
    entry: './index.js',
    hbr: true,
    devServer: true,
    devServerPort: 80,
    userInjectOnHbr: 'window.dispatchEvent(new CustomEvent("SIMPLE_HTML_SAVE_STATE"));',
    indexTemplate: /*html*/ `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Document</title>
        <link href="./index.css" rel="stylesheet" />
        <link href="./app.css" rel="stylesheet" />
       
        $bundle
      </head>
      <body>
      </body>
      </html>
      `
});

const checker_client = TypeChecker({
    basePath: `./`,
    name: 'checker_client',
    tsConfigJsonContent: {
        compilerOptions: {
            target: 'es2018',
            module: 'esNext',
            lib: ['es2019', 'dom'],
            moduleResolution: 'node',
            isolatedModules: false,
            preserveConstEnums: true,
            allowSyntheticDefaultImports: true,
            skipLibCheck: true,
            sourceMap: true,
            inlineSources: true,
            declaration: true,
            noImplicitAny: true,
            noImplicitReturns: true,
            noImplicitUseStrict: true,
            noUnusedParameters: true,
            suppressImplicitAnyIndexErrors: true,
            noFallthroughCasesInSwitch: true,
            noImplicitThis: false,
            noUnusedLocals: true,
            allowUnreachableCode: false,
            removeComments: true,
            emitDecoratorMetadata: false,
            importHelpers: false,
            strictNullChecks: false,
            experimentalDecorators: true,
            baseUrl: './',
            rootDir: '',
            paths: {
                '@simple-html*': ['packages*']
            }
        },
        exclude: ['node_modules', 'config_devserver.ts']
    }
});

checker_client.printSettings();
checker_client.inspectAndPrint();
checker_client.worker_watch('./');
