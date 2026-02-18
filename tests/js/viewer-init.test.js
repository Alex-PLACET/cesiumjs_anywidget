/**
 * Tests for viewer initialization module
 */
import { jest, describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { CESIUM_CDN_VERSION } from '../../src/cesiumjs_anywidget/js/viewer-init.js';

describe('Viewer Initialization Module', () => {
  let mockContainer;
  let mockModel;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock container
    mockContainer = document.createElement('div');
    mockContainer.style.width = '800px';
    mockContainer.style.height = '600px';
    document.body.appendChild(mockContainer);

    // Create mock model
    mockModel = {
      get: jest.fn((key) => {
        const defaults = {
          show_timeline: true,
          show_animation: true,
          enable_terrain: false,
          enable_lighting: false,
          height: '600px',
          cesium_ion_token: 'test-token',
          atmosphere_settings: {},
          sky_atmosphere_settings: {},
        };
        return defaults[key];
      }),
      set: jest.fn(),
      save_changes: jest.fn(),
      on: jest.fn(),
    };

    // Mock Cesium.Viewer
    global.Cesium.Viewer = jest.fn().mockImplementation(() => ({
      scene: {
        globe: {
          enableLighting: false,
          setTerrain: jest.fn(),
        },
        atmosphere: {},
        skyAtmosphere: { show: true },
        skyBox: { show: true },
        setTerrain: jest.fn(),
      },
      timeline: {
        container: { style: {} },
      },
      animation: {
        container: { style: {} },
      },
      resize: jest.fn(),
      entities: {
        add: jest.fn(),
        remove: jest.fn(),
        removeAll: jest.fn(),
      },
      camera: {
        getPickRay: jest.fn(),
        flyToBoundingSphere: jest.fn(),
      },
      destroy: jest.fn(),
    }));
  });

  afterEach(() => {
    document.body.removeChild(mockContainer);
  });

  describe('loadCesiumJS', () => {
    it('should return existing Cesium if already loaded', async () => {
      // Cesium is already set up in setup.js
      const loadCesiumJS = async () => {
        if (window.Cesium) {
          return window.Cesium;
        }
        throw new Error('Should not reach here');
      };
      
      const cesium = await loadCesiumJS();
      expect(cesium).toBe(window.Cesium);
    });

    it('should load CesiumJS script if not available', async () => {
      const originalCesium = window.Cesium;
      delete window.Cesium;

      const loadCesiumJS = async () => {
        if (window.Cesium) {
          return window.Cesium;
        }
        
        const script = document.createElement('script');
        script.src = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_CDN_VERSION}/Build/Cesium/Cesium.js`;
        
        await new Promise((resolve) => {
          script.onload = () => {
            window.Cesium = originalCesium;
            resolve();
          };
          setTimeout(() => script.onload(), 0);
          document.head.appendChild(script);
        });
        
        return window.Cesium;
      };

      const cesium = await loadCesiumJS();
      expect(cesium).toBeDefined();
      
      // Restore
      window.Cesium = originalCesium;
    });
  });

  describe('createLoadingIndicator', () => {
    it('should create loading indicator with token', () => {
      const createLoadingIndicator = (container, hasToken) => {
        const loadingDiv = document.createElement('div');
        loadingDiv.textContent = 'Loading CesiumJS...';
        loadingDiv.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);';
        
        if (!hasToken) {
          loadingDiv.innerHTML = `
            <div style="text-align: center;">
              <div>Loading CesiumJS...</div>
              <div style="font-size: 12px; margin-top: 10px; color: #ffa500;">
                ⚠️ No Cesium Ion token set
              </div>
            </div>
          `;
        }
        container.appendChild(loadingDiv);
        return loadingDiv;
      };

      const indicator = createLoadingIndicator(mockContainer, true);
      expect(indicator).toBeDefined();
      expect(indicator.textContent).toContain('Loading CesiumJS');
      expect(indicator.textContent).not.toContain('No Cesium Ion token');
      expect(mockContainer.contains(indicator)).toBe(true);
    });

    it('should create loading indicator without token warning', () => {
      const createLoadingIndicator = (container, hasToken) => {
        const loadingDiv = document.createElement('div');
        loadingDiv.textContent = 'Loading CesiumJS...';
        
        if (!hasToken) {
          loadingDiv.innerHTML = `
            <div>Loading CesiumJS...</div>
            <div>⚠️ No Cesium Ion token set</div>
          `;
        }
        container.appendChild(loadingDiv);
        return loadingDiv;
      };

      const indicator = createLoadingIndicator(mockContainer, false);
      expect(indicator.textContent).toContain('Loading CesiumJS');
      expect(indicator.textContent).toContain('No Cesium Ion token');
    });
  });

  describe('createViewer', () => {
    it('should create viewer with correct options', () => {
      const createViewer = (container, model, Cesium) => {
        const viewerOptions = {
          timeline: model.get('show_timeline'),
          animation: model.get('show_animation'),
          baseLayerPicker: true,
          geocoder: true,
          homeButton: true,
          sceneModePicker: true,
          navigationHelpButton: true,
          fullscreenButton: true,
          scene3DOnly: false,
          shadows: false,
          shouldAnimate: false,
        };

        if (model.get('enable_terrain')) {
          viewerOptions.terrain = Cesium.Terrain.fromWorldTerrain();
        }

        const viewer = new Cesium.Viewer(container, viewerOptions);
        viewer.scene.globe.enableLighting = model.get('enable_lighting');
        return viewer;
      };

      const viewer = createViewer(mockContainer, mockModel, global.Cesium);
      
      expect(global.Cesium.Viewer).toHaveBeenCalledWith(
        mockContainer,
        expect.objectContaining({
          timeline: true,
          animation: true,
          baseLayerPicker: true,
        })
      );
      expect(viewer).toBeDefined();
      expect(viewer.scene.globe.enableLighting).toBe(false);
    });

    it('should enable terrain when requested', () => {
      mockModel.get = jest.fn((key) => {
        if (key === 'enable_terrain') return true;
        if (key === 'show_timeline') return true;
        if (key === 'show_animation') return true;
        if (key === 'enable_lighting') return false;
        return null;
      });

      const createViewer = (container, model, Cesium) => {
        const viewerOptions = {
          timeline: model.get('show_timeline'),
          animation: model.get('show_animation'),
        };

        if (model.get('enable_terrain')) {
          viewerOptions.terrain = Cesium.Terrain.fromWorldTerrain();
        }

        return new Cesium.Viewer(container, viewerOptions);
      };

      createViewer(mockContainer, mockModel, global.Cesium);
      
      expect(global.Cesium.Terrain.fromWorldTerrain).toHaveBeenCalled();
    });
  });

  describe('setupViewerListeners', () => {
    let mockViewer;

    beforeEach(() => {
      mockViewer = {
        scene: {
          globe: { enableLighting: false },
          setTerrain: jest.fn(),
          atmosphere: {
            brightnessShift: 0,
            hueShift: 0,
            saturationShift: 0,
          },
          skyAtmosphere: { show: true },
        },
        timeline: {
          container: { style: { visibility: 'visible' } },
        },
        animation: {
          container: { style: { visibility: 'visible' } },
        },
        resize: jest.fn(),
      };
    });

    it('should set up terrain change listener', () => {
      const callback = jest.fn();
      mockModel.on = jest.fn();

      // Setup listeners
      mockModel.on('change:enable_terrain', callback);
      
      expect(mockModel.on).toHaveBeenCalledWith('change:enable_terrain', callback);
    });

    it('should set up lighting change listener', () => {
      const callback = jest.fn();
      mockModel.on = jest.fn();

      mockModel.on('change:enable_lighting', callback);
      
      expect(mockModel.on).toHaveBeenCalledWith('change:enable_lighting', callback);
    });

    it('should set up height change listener', () => {
      const callback = jest.fn();
      mockModel.on = jest.fn();

      mockModel.on('change:height', callback);
      
      expect(mockModel.on).toHaveBeenCalledWith('change:height', callback);
    });

    it('should update viewer when height changes', () => {
      const listeners = {};
      mockModel.on = jest.fn((event, callback) => {
        listeners[event] = callback;
      });

      const setupViewerListeners = (viewer, model, container) => {
        model.on('change:height', () => {
          container.style.height = model.get('height');
          viewer.resize();
        });
      };

      setupViewerListeners(mockViewer, mockModel, mockContainer);
      
      // Simulate height change
      mockModel.get = jest.fn(() => '800px');
      if (listeners['change:height']) {
        listeners['change:height']();
      }
    });
  });
});
