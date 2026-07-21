const checker = require('esbuild-helpers').TypeChecker({
    basePath: './',
    tsConfig: 'tsconfig.json'
});
checker.printSettings();
const result = checker.inspectOnly();
checker.printOnly(result);

// comma operator here only evaluated the last length, so option/global/syntactic errors were ignored
if (result.optionsErrors.length || result.globalErrors.length || result.syntacticErrors.length || result.semanticErrors.length) {
    throw 'type errors';
}
