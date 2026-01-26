# JavaScript Tests for CesiumJS AnyWidget

This directory contains Jest tests for the JavaScript modules of the CesiumJS AnyWidget.

## Setup

Install test dependencies:

```bash
npm install
```

## Running Tests

Run all tests:
```bash
npm test
```

Run tests in watch mode (for development):
```bash
npm run test:watch
```

Run tests with coverage report:
```bash
npm run test:coverage
```

## Test Structure

- **`logger.test.js`** - Tests for the logging module (debug mode, log levels)
- **`viewer-init.test.js`** - Tests for viewer initialization and configuration
- **`camera-sync.test.js`** - Tests for camera synchronization between viewer and Python
- **`measurement-tools.test.js`** - Tests for measurement tools functionality
- **`setup.js`** - Global test setup and Cesium mocks
- **`__mocks__/styleMock.js`** - Mock for CSS imports

## Test Coverage

Current modules tested:
- ✅ Logger (setDebugMode, log, warn, error)
- ✅ Viewer initialization (loadCesiumJS, createViewer, setupViewerListeners)
- ✅ Camera synchronization (position tracking, fly-to, debouncing)
- ✅ Measurement tools (area calculation, formatting, UI components, drag functionality)

## Mocking Strategy

The tests use JSDOM to simulate a browser environment and mock the Cesium library since it's loaded from CDN at runtime. The mocks are defined in `setup.js` and provide minimal implementations of Cesium classes and methods needed for testing.

## Writing New Tests

When adding new test files:

1. Create a file named `*.test.js` in this directory
2. Import the necessary modules (mocks are auto-loaded via setup.js)
3. Use Jest's `describe`, `it`, `beforeEach`, `afterEach` structure
4. Clean up any DOM elements or listeners in `afterEach`

Example:
```javascript
describe('My Module', () => {
  let mockContainer;

  beforeEach(() => {
    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);
  });

  afterEach(() => {
    document.body.removeChild(mockContainer);
  });

  it('should do something', () => {
    // Your test here
    expect(true).toBe(true);
  });
});
```

## Notes

- Tests use ES modules (type: "module" in package.json)
- Jest is run with `--experimental-vm-modules` flag for ESM support
- The bundled `index.js` file is not directly tested; instead, tests focus on individual modules in `src/cesiumjs_anywidget/js/`
