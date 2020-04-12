module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    maxConcurrency: 1,
    moduleNameMapper: {
        'lit-html': '<rootDir>/.cache/lit-html.js'
    }
};
