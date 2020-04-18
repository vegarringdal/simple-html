module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jest-environment-jsdom-sixteen',
    maxConcurrency: 1,
    verbose: true,
    moduleDirectories: ['node_modules'],
    transformIgnorePatterns: [
        // Change MODULE_NAME_HERE to your module that isn't being compiled
        '/node_modules/(?!lit-html).+\\.js$'
    ],
    transform: {
        '^.+\\.(js|jsx|ts|tsx)$': '<rootDir>/node_modules/babel-jest'
    }
};
