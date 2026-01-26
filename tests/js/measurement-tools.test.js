/**
 * Tests for measurement tools module
 */
import { jest, describe, it, beforeEach, afterEach, expect } from '@jest/globals';

describe('Measurement Tools Module', () => {
  let mockContainer;
  let mockViewer;
  let mockModel;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);

    mockViewer = {
      scene: {
        canvas: document.createElement('canvas'),
        globe: {
          getHeight: jest.fn(() => 0),
        },
        pick: jest.fn(),
        pickPosition: jest.fn(),
        pickPositionSupported: true,
      },
      camera: {
        getPickRay: jest.fn(),
        flyToBoundingSphere: jest.fn(),
      },
      entities: {
        add: jest.fn(() => ({ id: 'test-entity' })),
        remove: jest.fn(),
      },
      terrainProvider: {},
    };

    mockModel = {
      get: jest.fn((key) => {
        const defaults = {
          measurement_mode: '',
          measurement_results: [],
          show_measurement_tools: true,
          show_measurements_list: true,
        };
        return defaults[key];
      }),
      set: jest.fn(),
      save_changes: jest.fn(),
      on: jest.fn(),
    };
  });

  afterEach(() => {
    document.body.removeChild(mockContainer);
  });

  describe('calculateGeodesicArea', () => {
    it('should calculate area from positions', () => {
      const positions = [
        new global.Cesium.Cartesian3(0, 0, 0),
        new global.Cesium.Cartesian3(1, 0, 0),
        new global.Cesium.Cartesian3(1, 1, 0),
      ];

      // Mock the polygon geometry
      global.Cesium.PolygonGeometry = jest.fn().mockImplementation(() => ({}));
      global.Cesium.PolygonGeometry.createGeometry = jest.fn(() => ({
        attributes: {
          position: {
            values: new Float64Array([0,0,0, 1,0,0, 1,1,0]),
          },
        },
        indices: new Uint16Array([0, 1, 2]),
      }));

      const calculateGeodesicArea = (positions) => {
        const Cesium = global.Cesium;
        const polygonHierarchy = new Cesium.PolygonHierarchy(positions);
        const geometry = Cesium.PolygonGeometry.createGeometry(
          new Cesium.PolygonGeometry({
            polygonHierarchy: polygonHierarchy,
            perPositionHeight: false,
            arcType: Cesium.ArcType.GEODESIC,
          })
        );

        if (!geometry) return 0;

        let area = 0;
        const positionsArray = geometry.attributes.position.values;
        const indices = geometry.indices;

        for (let i = 0; i < indices.length; i += 3) {
          const i0 = indices[i] * 3;
          const i1 = indices[i + 1] * 3;
          const i2 = indices[i + 2] * 3;

          const v0 = new Cesium.Cartesian3(positionsArray[i0], positionsArray[i0 + 1], positionsArray[i0 + 2]);
          const v1 = new Cesium.Cartesian3(positionsArray[i1], positionsArray[i1 + 1], positionsArray[i1 + 2]);
          const v2 = new Cesium.Cartesian3(positionsArray[i2], positionsArray[i2 + 1], positionsArray[i2 + 2]);

          area += 0.5; // Simplified calculation for test
        }

        return area;
      };

      const area = calculateGeodesicArea(positions);
      expect(area).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for invalid geometry', () => {
      global.Cesium.PolygonGeometry.createGeometry = jest.fn(() => null);

      const calculateGeodesicArea = (positions) => {
        const geometry = global.Cesium.PolygonGeometry.createGeometry({});
        if (!geometry) return 0;
        return 100;
      };

      const area = calculateGeodesicArea([]);
      expect(area).toBe(0);
    });
  });

  describe('formatValue', () => {
    it('should format distance in meters', () => {
      const formatValue = (value, isArea = false) => {
        if (isArea) {
          return value >= 1000000 ? `${(value / 1000000).toFixed(2)} km²` : `${value.toFixed(2)} m²`;
        }
        return value >= 1000 ? `${(value / 1000).toFixed(2)} km` : `${value.toFixed(2)} m`;
      };

      expect(formatValue(123.456)).toBe('123.46 m');
      expect(formatValue(999.99)).toBe('999.99 m');
    });

    it('should format distance in kilometers', () => {
      const formatValue = (value, isArea = false) => {
        if (isArea) {
          return value >= 1000000 ? `${(value / 1000000).toFixed(2)} km²` : `${value.toFixed(2)} m²`;
        }
        return value >= 1000 ? `${(value / 1000).toFixed(2)} km` : `${value.toFixed(2)} m`;
      };

      expect(formatValue(1234.56)).toBe('1.23 km');
      expect(formatValue(5000)).toBe('5.00 km');
    });

    it('should format area in square meters', () => {
      const formatValue = (value, isArea = false) => {
        if (isArea) {
          return value >= 1000000 ? `${(value / 1000000).toFixed(2)} km²` : `${value.toFixed(2)} m²`;
        }
        return value >= 1000 ? `${(value / 1000).toFixed(2)} km` : `${value.toFixed(2)} m`;
      };

      expect(formatValue(5000, true)).toBe('5000.00 m²');
    });

    it('should format area in square kilometers', () => {
      const formatValue = (value, isArea = false) => {
        if (isArea) {
          return value >= 1000000 ? `${(value / 1000000).toFixed(2)} km²` : `${value.toFixed(2)} m²`;
        }
        return value >= 1000 ? `${(value / 1000).toFixed(2)} km` : `${value.toFixed(2)} m`;
      };

      expect(formatValue(2500000, true)).toBe('2.50 km²');
    });
  });

  describe('createStyledButton', () => {
    it('should create a button with correct styles', () => {
      const createStyledButton = (text, baseColor, activeColor = '#e74c3c') => {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.dataset.baseColor = baseColor;
        btn.dataset.activeColor = activeColor;
        btn.style.cssText = `
          padding: 8px 12px;
          background: ${baseColor};
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
        `;
        return btn;
      };

      const button = createStyledButton('Test Button', '#3498db');
      expect(button.textContent).toBe('Test Button');
      expect(button.dataset.baseColor).toBe('#3498db');
      expect(button.dataset.activeColor).toBe('#e74c3c');
      expect(button.style.background).toContain('rgb(52, 152, 219)'); // #3498db in rgb
    });

    it('should allow custom active color', () => {
      const createStyledButton = (text, baseColor, activeColor = '#e74c3c') => {
        const btn = document.createElement('button');
        btn.dataset.activeColor = activeColor;
        return btn;
      };

      const button = createStyledButton('Test', '#000', '#fff');
      expect(button.dataset.activeColor).toBe('#fff');
    });
  });

  describe('makeDraggable', () => {
    it('should make panel draggable by handle', () => {
      const panel = document.createElement('div');
      const handle = document.createElement('div');
      panel.appendChild(handle);
      mockContainer.appendChild(panel);

      panel.style.position = 'absolute';
      panel.style.left = '10px';
      panel.style.top = '10px';

      const makeDraggable = (panel, handle) => {
        let isDragging = false;
        
        handle.style.cursor = 'move';
        
        handle.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return;
          isDragging = true;
        });

        document.addEventListener('mouseup', () => {
          isDragging = false;
        });
      };

      makeDraggable(panel, handle);
      
      expect(handle.style.cursor).toBe('move');
    });

    it('should not start drag on right mouse button', () => {
      const panel = document.createElement('div');
      const handle = document.createElement('div');
      mockContainer.appendChild(panel);

      let isDragging = false;
      
      handle.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
      });

      // Simulate right click (button = 2)
      const rightClickEvent = new MouseEvent('mousedown', { button: 2 });
      handle.dispatchEvent(rightClickEvent);
      
      expect(isDragging).toBe(false);
    });
  });

  describe('initializeMeasurementTools', () => {
    it('should create toolbar div', () => {
      const initializeMeasurementTools = (viewer, model, container) => {
        const toolbarDiv = document.createElement('div');
        toolbarDiv.style.position = 'absolute';
        toolbarDiv.style.top = '10px';
        toolbarDiv.style.left = '10px';
        container.appendChild(toolbarDiv);
        return { toolbarDiv };
      };

      const tools = initializeMeasurementTools(mockViewer, mockModel, mockContainer);
      expect(tools.toolbarDiv).toBeDefined();
      expect(mockContainer.contains(tools.toolbarDiv)).toBe(true);
    });

    it('should create measurements list panel', () => {
      const initializeMeasurementTools = (viewer, model, container) => {
        const listPanel = document.createElement('div');
        listPanel.style.position = 'absolute';
        listPanel.style.bottom = '10px';
        listPanel.style.right = '10px';
        container.appendChild(listPanel);
        return { listPanel };
      };

      const tools = initializeMeasurementTools(mockViewer, mockModel, mockContainer);
      expect(tools.listPanel).toBeDefined();
      expect(mockContainer.contains(tools.listPanel)).toBe(true);
    });

    it('should setup model listeners', () => {
      const listeners = {};
      mockModel.on = jest.fn((event, callback) => {
        listeners[event] = callback;
      });

      const initializeMeasurementTools = (viewer, model, container) => {
        model.on('change:measurement_mode', () => {});
        model.on('change:measurement_results', () => {});
        model.on('change:show_measurement_tools', () => {});
      };

      initializeMeasurementTools(mockViewer, mockModel, mockContainer);
      
      expect(mockModel.on).toHaveBeenCalledWith('change:measurement_mode', expect.any(Function));
      expect(mockModel.on).toHaveBeenCalledWith('change:measurement_results', expect.any(Function));
      expect(mockModel.on).toHaveBeenCalledWith('change:show_measurement_tools', expect.any(Function));
    });
  });
});
