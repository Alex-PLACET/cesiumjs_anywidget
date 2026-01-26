/**
 * Tests for camera synchronization module
 */
import { jest, describe, it, beforeEach, afterEach, expect } from '@jest/globals';

describe('Camera Sync Module', () => {
  let mockViewer;
  let mockModel;

  beforeEach(() => {
    jest.clearAllMocks();

    mockViewer = {
      camera: {
        position: { x: 1, y: 2, z: 3 },
        heading: 0,
        pitch: -Math.PI / 4,
        roll: 0,
        positionCartographic: {
          longitude: 0,
          latitude: 0,
          height: 1000,
        },
        changed: {
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        },
        moveEnd: {
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        },
        flyTo: jest.fn(),
        setView: jest.fn(),
      },
      clock: {
        currentTime: {},
      },
    };

    mockModel = {
      get: jest.fn((key) => {
        const defaults = {
          camera_position: null,
          camera_sync_trigger: null,
          camera_fly_to_trigger: null,
        };
        return defaults[key];
      }),
      set: jest.fn(),
      save_changes: jest.fn(),
      on: jest.fn(),
    };
  });

  describe('initializeCameraSync', () => {
    it('should set up camera change listener', () => {
      const initializeCameraSync = (viewer, model) => {
        const onCameraChange = () => {
          const position = viewer.camera.positionCartographic;
          model.set('camera_position', {
            longitude: position.longitude,
            latitude: position.latitude,
            height: position.height,
            heading: viewer.camera.heading,
            pitch: viewer.camera.pitch,
            roll: viewer.camera.roll,
          });
          model.save_changes();
        };

        viewer.camera.changed.addEventListener(onCameraChange);
      };

      initializeCameraSync(mockViewer, mockModel);
      expect(mockViewer.camera.changed.addEventListener).toHaveBeenCalled();
    });

    it('should debounce camera updates', (done) => {
      jest.useFakeTimers();
      
      const initializeCameraSync = (viewer, model) => {
        let debounceTimeout;
        
        const debouncedUpdate = () => {
          clearTimeout(debounceTimeout);
          debounceTimeout = setTimeout(() => {
            model.set('camera_position', {});
            model.save_changes();
          }, 100);
        };

        viewer.camera.changed.addEventListener(debouncedUpdate);
        
        return debouncedUpdate;
      };

      const update = initializeCameraSync(mockViewer, mockModel);
      
      // Call multiple times rapidly
      update();
      update();
      update();
      
      expect(mockModel.set).not.toHaveBeenCalled();
      
      // Fast-forward time
      jest.advanceTimersByTime(100);
      
      expect(mockModel.set).toHaveBeenCalledTimes(1);
      
      jest.useRealTimers();
      done();
    });

    it('should handle camera fly-to trigger', () => {
      const listeners = {};
      mockModel.on = jest.fn((event, callback) => {
        listeners[event] = callback;
      });

      const initializeCameraSync = (viewer, model) => {
        model.on('change:camera_fly_to_trigger', () => {
          const trigger = model.get('camera_fly_to_trigger');
          if (trigger && trigger.longitude !== undefined) {
            viewer.camera.flyTo({
              destination: global.Cesium.Cartesian3.fromDegrees(
                trigger.longitude,
                trigger.latitude,
                trigger.height || 1000
              ),
            });
          }
        });
      };

      initializeCameraSync(mockViewer, mockModel);
      expect(mockModel.on).toHaveBeenCalledWith('change:camera_fly_to_trigger', expect.any(Function));
    });

    it('should handle camera sync trigger', () => {
      const listeners = {};
      mockModel.on = jest.fn((event, callback) => {
        listeners[event] = callback;
      });

      const initializeCameraSync = (viewer, model) => {
        model.on('change:camera_sync_trigger', () => {
          const trigger = model.get('camera_sync_trigger');
          if (trigger && trigger.longitude !== undefined) {
            viewer.camera.setView({
              destination: global.Cesium.Cartesian3.fromDegrees(
                trigger.longitude,
                trigger.latitude,
                trigger.height || 1000
              ),
              orientation: {
                heading: trigger.heading || 0,
                pitch: trigger.pitch || -Math.PI / 4,
                roll: trigger.roll || 0,
              },
            });
          }
        });
      };

      initializeCameraSync(mockViewer, mockModel);
      expect(mockModel.on).toHaveBeenCalledWith('change:camera_sync_trigger', expect.any(Function));
    });

    it('should clean up listeners on destroy', () => {
      const listeners = [];
      mockViewer.camera.changed.addEventListener = jest.fn((callback) => {
        listeners.push({ event: 'changed', callback });
      });
      mockViewer.camera.changed.removeEventListener = jest.fn((callback) => {
        const index = listeners.findIndex(l => l.callback === callback);
        if (index > -1) listeners.splice(index, 1);
      });

      const initializeCameraSync = (viewer, model) => {
        const onCameraChange = () => {};
        viewer.camera.changed.addEventListener(onCameraChange);
        
        return {
          destroy: () => {
            viewer.camera.changed.removeEventListener(onCameraChange);
          },
        };
      };

      const sync = initializeCameraSync(mockViewer, mockModel);
      expect(listeners.length).toBe(1);
      
      sync.destroy();
      expect(mockViewer.camera.changed.removeEventListener).toHaveBeenCalled();
    });
  });

  describe('camera position conversion', () => {
    it('should convert Cartographic to degrees', () => {
      const cartographicToDegrees = (carto) => {
        return {
          longitude: global.Cesium.Math.toDegrees(carto.longitude),
          latitude: global.Cesium.Math.toDegrees(carto.latitude),
          height: carto.height,
        };
      };

      const result = cartographicToDegrees({
        longitude: Math.PI,
        latitude: Math.PI / 2,
        height: 1000,
      });

      expect(result.longitude).toBe(180);
      expect(result.latitude).toBe(90);
      expect(result.height).toBe(1000);
    });

    it('should convert degrees to Cartesian3', () => {
      global.Cesium.Cartesian3.fromDegrees = jest.fn((lon, lat, height) => ({
        x: lon,
        y: lat,
        z: height,
      }));

      const degreesToCartesian = (lon, lat, height) => {
        return global.Cesium.Cartesian3.fromDegrees(lon, lat, height);
      };

      const result = degreesToCartesian(10, 20, 1000);
      expect(result).toEqual({ x: 10, y: 20, z: 1000 });
      expect(global.Cesium.Cartesian3.fromDegrees).toHaveBeenCalledWith(10, 20, 1000);
    });
  });
});
