module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    maxConcurrency: 1,
    moduleDirectories: ['node_modules'],
    transformIgnorePatterns: [
        // Change MODULE_NAME_HERE to your module that isn't being compiled
        '/node_modules/(?!lit-html).+\\.js$'
    ],
    transform: {
        '^.+\\.(js|jsx|ts|tsx)$': '<rootDir>/node_modules/babel-jest'
    }
};
