module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jest-environment-jsdom-sixteen',
    maxConcurrency: 1,
    verbose: true,
    moduleDirectories: ['node_modules'],
    moduleNameMapper: {
        'lit-html': '<rootDir>/.cache/lit-html/lit-html.js'
    },
    globals: {
        'ts-jest': {
            diagnostics: false,
            tsConfig: './tsconfig.json'
        }
    }
};
