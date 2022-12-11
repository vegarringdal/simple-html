module.exports = {
    testEnvironment: "node",
    collectCoverageFrom: [],
    transform: {
        "^.+\\.(ts)$": [
            "ts-jest",
            {
                tsconfig: "<rootDir>/packages/tsconfig.json",
                diagnostics: false
            }
        ]
    }
};