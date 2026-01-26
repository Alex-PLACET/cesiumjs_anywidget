export default {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/js/**/*.test.js'],
  transform: {},
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/js/__mocks__/styleMock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/js/setup.js'],
  collectCoverageFrom: [
    'src/cesiumjs_anywidget/js/**/*.js',
    '!src/cesiumjs_anywidget/js/index.js', // Skip main entry point for now
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  testPathIgnorePatterns: ['/node_modules/', '/.venv/', '/htmlcov/'],
  modulePathIgnorePatterns: ['<rootDir>/.venv/', '<rootDir>/htmlcov/'],
};
