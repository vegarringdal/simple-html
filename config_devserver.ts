import { clearFolders, addDefaultIndex, client, single, TypeChecker } from 'esbuild-helpers';

clearFolders('dist_client', 'dist_nodejs');

const sample = process.argv[2];


/**
 * client bundle
 */
client(
    { watch: [`./samples/${sample}/**/*.*`, './packages/**/*.*'] },
    {
        color: true,
        define: {
            DEVELOPMENT: 'true'
        },
        entryPoints: [`./samples/${sample}/index.ts`],
        outfile: `./dist/${sample}/index.js`,
        minify: false,
        bundle: true,
        tsconfig: `./samples/tsconfig.json`,
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
        exclude: ['node_modules', 'config_devserver.ts', 'dist']
    }
});

checker_client.printSettings();
checker_client.inspectAndPrint();
checker_client.worker_watch(['./samples', './packages']);
