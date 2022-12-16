/* eslint-disable @typescript-eslint/no-var-requires */
const { readFiles, logInfo } = require('./utils');
const { clearFolders, copySync } = require('esbuild-helpers');

async function run() {
    const files = await readFiles('./packages');
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.isDirectory() && file.name !== 'template-package') {
            logInfo(`\n\n ${file.name}: Remove old dist folder`);
            clearFolders(`packages/${file.name}/dist/`);

            const checker = require('esbuild-helpers').TypeChecker({
                tsConfigOverride: {
                    compilerOptions: {
                        outDir: `./dist`,
                        rootDir: `./src`,
                        target: 'es2018',
                        module: 'esNext',
                        lib: ['es2021', 'dom'],
                        skipLibCheck: true,
                        moduleResolution: 'node',
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
                        experimentalDecorators: true
                    },
                    exclude: ['dist', 'node_modules', '**/__tests__']
                },
                skipTsErrors: [2307], // I dont care about modules @simple-html/xxxxx
                basePath: `./packages/${file.name}`,
                name: `build ${file.name}`
            });
            checker.printSettings();
            let result = checker.inspectOnly();
            checker.printOnly(result);
            logInfo(`${file.name}: emit js`);
            result.oldProgram.emit();

            //copy css files
            logInfo(`${file.name}: copy css if any`);
            copySync(`packages/${file.name}/src/**/*.css`, `packages/${file.name}/dist`);
        }
    }
}
run();
