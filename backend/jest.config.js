module.exports = {
  setupFiles: ['<rootDir>/tests/environment.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/mysql/'],
  verbose: true,
  maxWorkers: 1
};
