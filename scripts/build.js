/* eslint-disable @typescript-eslint/no-var-requires */
const { logInfo } = require('./utils');
const { clearFolders, copy, TypeChecker } = require('esbuild-helpers');

/**
 * Builds src -> dist for the single @simple-html/grid package.
 * Emits js + d.ts and copies the css alongside.
 * Runs as `prepare` too, so installing straight from a git branch builds dist.
 * `npm run build:tgz` packs a tgz into ./build.
 */
async function run() {
    logInfo('\n\n Remove old dist folder');
    clearFolders('dist/');

    const checker = TypeChecker({
        tsConfigOverride: {
            compilerOptions: {
                outDir: './dist',
                rootDir: './src',
                target: 'es2025',
                module: 'esNext',
                lib: ['es2025', 'dom'],
                skipLibCheck: true,
                moduleResolution: 'bundler',
                isolatedModules: false,
                preserveConstEnums: true,
                allowSyntheticDefaultImports: true,
                sourceMap: true,
                inlineSources: true,
                preserveSymlinks: true,
                declaration: true,
                declarationMap: true,
                noImplicitAny: true,
                noImplicitReturns: true,
                noUnusedParameters: true,
                noFallthroughCasesInSwitch: true,
                noImplicitThis: false,
                noUnusedLocals: true,
                allowUnreachableCode: false,
                removeComments: false,
                // members tagged @internal are left out of the published .d.ts files
                stripInternal: true,
                emitDecoratorMetadata: false,
                importHelpers: false,
                strict: true,
                experimentalDecorators: true
            },
            include: ['src'],
            exclude: ['dist', 'node_modules', '**/__tests__']
        },
        basePath: './',
        name: 'build grid'
    });

    checker.printSettings();
    const result = checker.inspectOnly();
    checker.printOnly(result);

    logInfo('emit js');
    result.oldProgram.emit();

    logInfo('copy css if any');
    await copy('src/**/*.css', 'dist');
}
run();
