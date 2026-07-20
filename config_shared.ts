/**
 * Shared bits between config_devserver.ts and config_demo_build.ts.
 *
 * The two builds are the same thing with different switches - dev serves a watched,
 * unminified build with hot reload, demo writes a minified one - so everything they agree
 * on lives here. The typechecker options in particular were duplicated word for word,
 * which meant the TypeScript 6 migration had to be done twice.
 */

/**
 * dev server output, throwaway and gitignored
 */
export const DEV_OUTPUT_ROOT = 'dist_dev';

/**
 * demo build output. This is what github pages serves, so it is committed - see the demo
 * link in the README.
 */
export const DEMO_OUTPUT_ROOT = 'docs';

/**
 * typechecker config, used by both builds
 */
export const TS_CONFIG = {
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
            '@simple-html/grid': ['./packages/grid/src']
        }
    },
    // node scripts have no business in a browser typecheck, and build output is not source
    exclude: ['node_modules', 'config_devserver.ts', 'config_demo_build.ts', 'config_shared.ts', 'dist', 'dist_dev', 'docs']
};

export const INDEX_TEMPLATE = /*html*/ `<!DOCTYPE html>
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
      `;

/**
 * esbuild options for a sample bundle
 */
export function clientOptions(options: { entrySample: string; outSample: string; outputRoot: string; development: boolean }) {
    return {
        color: true,
        define: {
            DEVELOPMENT: options.development ? 'true' : 'false'
        },
        entryPoints: [`./samples/${options.entrySample}/index.ts`],
        outfile: `./${options.outputRoot}/${options.outSample}/index.js`,
        minify: !options.development,
        bundle: true,
        tsconfig: './samples/tsconfig.json',
        platform: 'browser' as const,
        sourcemap: options.development,
        logLevel: 'error' as const
    };
}
