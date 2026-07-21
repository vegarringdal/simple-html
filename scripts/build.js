/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('node:fs');
const { logInfo, spawner } = require('./utils');
const { clearFolders, copy, TypeChecker } = require('esbuild-helpers');

/**
 * Builds src -> dist for the single @simple-html/grid package.
 * Emits js + d.ts, copies the css alongside, then packs a tgz into ./build.
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
                emitDecoratorMetadata: false,
                importHelpers: false,
                strictNullChecks: false,
                experimentalDecorators: true
            },
            include: ['src'],
            exclude: ['dist', 'node_modules', '**/__tests__']
        },
        skipTsErrors: [2307], // module @simple-html/xxxxx resolution, not relevant here
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

    // pack a tgz into ./build - wiped and recreated each run so it only holds the latest
    logInfo('pack tgz into ./build');
    fs.rmSync('./build', { recursive: true, force: true });
    fs.mkdirSync('./build', { recursive: true });
    const code = await spawner('npm', ['pack', '--pack-destination', './build'], process.cwd(), true);
    if (code !== 0) {
        throw new Error(`npm pack failed with exit code ${code}`);
    }
}
run();
