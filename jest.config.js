module.exports = {
    testEnvironment: 'jsdom',
    maxConcurrency: 1,
    verbose: true,
    moduleDirectories: ['node_modules'],
    transform: {                                                                                                                                                                                                                                                                                
        "^.+\\.(ts)$": ['ts-jest', {
            diagnostics: false,
            tsconfig: '<rootDir>/packages/tsconfig.json'
        }],                                                                                                                                                                                                             
    },
    collectCoverageFrom: [
        'packages/core/src/**/*.ts',
        'packages/router/src/**/*.ts',
        'packages/datasource/src/**/*.ts'
    ]
};
