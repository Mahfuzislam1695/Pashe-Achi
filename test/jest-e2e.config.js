/**
 * End-to-end tests: the real Nest app against a real PostgreSQL test database.
 * Run with `npm run test:e2e`. The database comes from TEST_DATABASE_URL, or DATABASE_URL in .env
 * with "_test" added to its name; it is created and migrated automatically, and its tables are
 * emptied before each run.
 */
module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Generated Prisma files import siblings as './x.js' while only './x.ts' exists.
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1', '^(\\.{1,2}/.*)\\.js$': '$1' },
  globalSetup: '<rootDir>/test/global-setup.js',
  setupFiles: ['<rootDir>/test/test-env.js'],
  testTimeout: 30000,
}
