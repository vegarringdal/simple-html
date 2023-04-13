import { clearFolders, addDefaultIndex, client, TypeChecker } from 'esbuild-helpers';

clearFolders('dist_client', 'dist_nodejs');

const sample = process.argv[2] || "grid01";

/**
 * client bundle
 */
client(
    { watch: [] },
    {
        color: true,
        define: {
            DEVELOPMENT: 'false'
        },
        entryPoints: [`./samples/${sample}/index.ts`],
        outfile: `./dist/${sample}/index.js`,
        minify: true,
        bundle: true,
        tsconfig: `./samples/tsconfig.json`,
        platform: 'browser',
        sourcemap: false,
        logLevel: 'error',
     
    }
);
/**
 * index file for project
 */
addDefaultIndex({
    distFolder: `dist/${sample}`,
    publicFolders: [],
    entry: './index.js',
    hbr: false,
    devServer: false,
    devServerPort: 8080,

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
            lib: ['es2021', 'dom'],
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
            baseUrl: './',
            rootDir: '',
            paths: {
                '@simple-html/grid': ['./packages/grid/src']
            }
        },
        exclude: ['node_modules', 'config_devserver.ts', 'dist']
    }
});

checker_client.printSettings();
checker_client.inspectAndPrint();

