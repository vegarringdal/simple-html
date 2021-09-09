const checker = require('esbuild-helpers').TypeChecker({
    basePath: './packages',
    tsConfig: 'tsconfig.json'
});
checker.printSettings();
const result = checker.inspectOnly();
checker.printOnly(result);

if (
    (result.optionsErrors.length,
    result.globalErrors.length,
    result.syntacticErrors.length,
    result.semanticErrors.length)
) {
    throw 'type errors';
}
