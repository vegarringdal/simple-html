module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    maxConcurrency: 1,
    verbose: true,
    moduleDirectories: ['node_modules'],
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
    ]
};
