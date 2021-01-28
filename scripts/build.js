const path = require('path');
const { readFiles, spawner, logInfo, logError } = require('./utils');

const { sparky } = require('fuse-box');
class Context {}
const { task, src, rm } = sparky(Context);

task('default', async (context) => {
    const files = await readFiles('./packages');
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.isDirectory() && file.name !== 'template-package') {
            logInfo(`\n\n ${file.name}: Remove old dist folder`);
            rm(`../packages/${file.name}/dist/`);

            const checker = require('fuse-box-typechecker').TypeChecker({
                tsConfigOverride: {
                    compilerOptions: {
                        outDir: `./dist`,
                        rootDir: `./src`,
                        target: 'es2018',
                        module: 'esNext',
                        lib: ['es2019', 'dom'],
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
                    exclude: ['dist', 'node_modules', '__tests__']
                },
                skipTsErrors: [2307], // I dont care about modules @simple-html/xxxxx
                basePath: `./packages/${file.name}`,
                name: `build ${file.name}`
            });
            checker.printSettings();
            let result = checker.inspectOnly();
            checker.printOnly(result);
            logInfo(`${file.name}: emit js`);
            const x = result.oldProgram.emit();

            const PATH = require('path').resolve(__dirname, '../packages');

            //copy css files
            logInfo(`${file.name}: copy css if any`);
            await src(`${PATH}/${file.name}/src/**/*.css`)
                .dest(`${PATH}/${file.name}/dist`, `src`)
                .exec();
        }
    }
});
