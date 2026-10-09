/** API unit tests (src/server/**\/*.spec.ts). Run with `npm test`, after the shared Vitest tests. */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/server/**/*.spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // "@/shared" is the src/shared folder; generated Prisma files import siblings as './x.js' while only './x.ts' exists.
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1', '^(\\.{1,2}/.*)\\.js$': '$1' },
}
