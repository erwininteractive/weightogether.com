/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	roots: ["<rootDir>/src", "<rootDir>/tests"],
	testMatch: ["**/__tests__/**/*.ts", "**/*.test.ts", "**/*.spec.ts"],
	collectCoverageFrom: [
		"src/**/*.ts",
		"!src/**/*.d.ts",
		"!src/server.ts", // Exclude entry point
		"!src/types/**", // Exclude type definitions
	],
	coverageDirectory: "coverage",
	coverageReporters: ["text", "lcov", "html"],
	moduleFileExtensions: ["ts", "js", "json"],
	transform: {
		"^.+\\.ts$": [
			"ts-jest",
			{
				tsconfig: {
					esModuleInterop: true,
				},
			},
		],
	},
	setupFiles: ["<rootDir>/tests/setup.ts"],
	globalTeardown: "<rootDir>/tests/teardown.ts",
	testTimeout: 15000, // Increased timeout for slow tests
	clearMocks: true,
	resetMocks: true,
	restoreMocks: true,
	maxWorkers: 1, // Run tests sequentially to avoid database deadlocks
	forceExit: true, // Force Jest to exit after tests complete
};
