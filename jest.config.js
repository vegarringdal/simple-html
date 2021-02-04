module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    maxConcurrency: 1,
    verbose: true,
    moduleDirectories: ['node_modules'],
    moduleNameMapper: {
        'lit-html': '<rootDir>/.cache/lit-html/lit-html.js',
        '@simple-html/core': '<rootDir>/packages/core/src/index.ts'
    },
    globals: {
        'ts-jest': {
            diagnostics: false,
            tsconfig: './packages/tsconfig.json'
        }
    },
    collectCoverageFrom: [
        'packages/core/src/**/*.ts',
        'packages/router/src/**/*.ts',
        'packages/datasource/src/**/*.ts'
        // todo: grid,
        // todo: datepaicker
    ]
};
