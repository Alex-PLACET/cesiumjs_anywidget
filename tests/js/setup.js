// Test setup file
import { jest } from '@jest/globals';

// Mock Cesium global
global.Cesium = {
  Viewer: jest.fn(),
  Ion: {
    defaultAccessToken: null,
  },
  Terrain: {
    fromWorldTerrain: jest.fn(),
  },
  Color: {
    RED: { red: 1, green: 0, blue: 0, alpha: 1 },
    BLUE: { red: 0, green: 0, blue: 1, alpha: 1 },
    GREEN: { red: 0, green: 1, blue: 0, alpha: 1 },
    ORANGE: { red: 1, green: 0.5, blue: 0, alpha: 1 },
    YELLOW: { red: 1, green: 1, blue: 0, alpha: 1 },
    WHITE: { red: 1, green: 1, blue: 1, alpha: 1 },
    fromAlpha: jest.fn((color, alpha) => ({ ...color, alpha })),
  },
  Cartesian3: jest.fn((x, y, z) => ({ x, y, z })),
  Cartographic: jest.fn(),
  Math: {
    toDegrees: jest.fn((rad) => rad * (180 / Math.PI)),
    toRadians: jest.fn((deg) => deg * (Math.PI / 180)),
  },
  ScreenSpaceEventHandler: jest.fn(),
  ScreenSpaceEventType: {
    LEFT_CLICK: 0,
    LEFT_DOWN: 1,
    LEFT_UP: 2,
    RIGHT_CLICK: 3,
    MOUSE_MOVE: 4,
  },
  CallbackProperty: jest.fn(),
  PolygonHierarchy: jest.fn(),
  PolygonGeometry: {
    createGeometry: jest.fn(),
  },
  ArcType: {
    GEODESIC: 0,
  },
  LabelStyle: {
    FILL_AND_OUTLINE: 0,
  },
  Cartesian2: jest.fn((x, y) => ({ x, y })),
  JulianDate: {
    now: jest.fn(() => ({})),
  },
  HeadingPitchRange: jest.fn(),
  BoundingSphere: {
    fromPoints: jest.fn(),
  },
};

// Mock window.Cesium
global.window = global.window || {};
global.window.Cesium = global.Cesium;
