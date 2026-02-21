/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Look for tests in tests/ and in .spec.ts files
  testMatch: ['**/tests/**/*.test.ts', '**/*.spec.ts'],
  // Jest root directory (the api app itself)
  rootDir: '.',
  // Clear mock calls between tests to avoid side effects
  clearMocks: true,
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/'],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
