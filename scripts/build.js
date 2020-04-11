const path = require('path');
const { readFiles, spawner, logInfo, logError } = require('./utils');

const { sparky } = require('fuse-box');
class Context {}
const { task, src } = sparky(Context);

task('default', async context => {
    const files = await readFiles('./packages');
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.isDirectory() && file.name !== 'template-package') {
            logInfo(`\n\n ${file.name}: Remove old dist folder`);
            await src(`../packages/${file.name}/dist/**/*.*`)
                .clean()
                .exec();

            const checker = require('fuse-box-typechecker').TypeChecker({
                tsConfigOverride: {
                    compilerOptions: {
                        outDir: `./dist/esm`,
                        rootDir: `./src`,
                        target: 'es2018',
                        module: 'esNext',
                        lib: ['es2019', 'dom'],
                        moduleResolution: 'node',
                        isolatedModules: false,
                        preserveConstEnums: true,
                        allowSyntheticDefaultImports: true,
                        skipLibCheck: true,
                        sourceMap: true,
                        preserveSymlinks: true,
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
                        emitDecoratorMetadata: true,
                        importHelpers: true,
                        strictNullChecks: false,
                        experimentalDecorators: true
                    },
                    exclude: ['dist', '_node_modules']
                },
                skipTsErrors: [2307, 6059], // I dont care about modules (2307) or tests (6059) outside src folder
                basePath: `./packages/${file.name}`,
                name: `build ${file.name}`
            });
            checker.printSettings();
            let result = checker.inspectOnly();
            checker.printOnly(result);
            logInfo(`${file.name}: emit js`);
            const x = result.oldProgram.emit();

            const PATH = require('path').resolve(__dirname, '../packages');
            //copy ts build
            logInfo(`${file.name}: copy ts`);
            await src(`${PATH}/${file.name}/src/**/*.*`)
                .dest(`${PATH}/${file.name}/dist/ts`, `src`)
                .exec();

            //copy css files
            logInfo(`${file.name}: copy css if any`);
            await src(`${PATH}/${file.name}/src/**/*.css`)
                .dest(`${PATH}/${file.name}/dist/esm`, `src`)
                .exec();
        }
    }
});
