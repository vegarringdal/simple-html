/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('node:fs');
const esbuild = require('esbuild');
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

    await buildSql();
}

/**
 * `@simple-html/grid/sql` is for a backend: Node loads it as it is, without a bundler. The files tsc
 * emits are ES modules with imports without extensions, which Node does not resolve - so the entry is
 * bundled into one file, for `import` (sql.mjs) and for `require` (sql.cjs). Its typings are one file
 * without imports (src/sql.ts has the whole public API), copied as sql.d.mts and sql.d.cts so each kind
 * of module gets typings of its own kind.
 *
 * It may only bundle the sql files and the filter rules of the datasource: a DOM module or lit-html in
 * it fails the build, it would not load in Node.
 */
async function buildSql() {
    logInfo('bundle the sql entry: dist/sql.mjs, dist/sql.cjs');
    for (const [format, file] of [
        ['esm', 'dist/sql.mjs'],
        ['cjs', 'dist/sql.cjs']
    ]) {
        const result = await esbuild.build({
            entryPoints: ['src/sql.ts'],
            outfile: file,
            bundle: true,
            format,
            platform: 'node',
            target: 'node20',
            sourcemap: true,
            metafile: true,
            logLevel: 'error'
        });
        const allowed =
            /^src\/(sql\.ts|sql\/[^/]+\.ts|grid\/formula\.ts|datasource\/(filterExpression|assertOptions|objectFilter|isBlank|textPattern|v5Filter|filterFields)\.ts)$/;
        const others = Object.keys(result.metafile.inputs).filter((input) => !allowed.test(input));
        if (others.length) {
            throw new Error(`the sql entry may not bundle ${others.join(', ')}: it has to load in Node, without a DOM`);
        }
    }
    const typings = fs.readFileSync('dist/sql.d.ts', 'utf8');
    if (/^\s*(import|export .* from)\b/m.test(typings)) {
        throw new Error('dist/sql.d.ts imports from another file: the public API of the sql entry belongs in src/sql.ts');
    }
    fs.copyFileSync('dist/sql.d.ts', 'dist/sql.d.mts');
    fs.copyFileSync('dist/sql.d.ts', 'dist/sql.d.cts');
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
