/**
 * Viewer Initialization Module
 * 
 * Handles CesiumJS viewer creation, configuration, and dynamic content loading
 * (terrain, lighting, GeoJSON).
 */

import { log, warn, error } from './logger.js';

const PREFIX = 'ViewerInit';

/**
 * Load CesiumJS library dynamically if not already loaded
 * @returns {Promise<Object>} Cesium global object
 */
export async function loadCesiumJS() {
  log(PREFIX, 'Loading CesiumJS...');
  if (window.Cesium) {
    log(PREFIX, 'CesiumJS already loaded, reusing existing instance');
    return window.Cesium;
  }

  const script = document.createElement('script');
  script.src = 'https://cesium.com/downloads/cesiumjs/releases/1.135/Build/Cesium/Cesium.js';
  log(PREFIX, 'Loading CesiumJS from CDN...');

  await new Promise((resolve, reject) => {
    script.onload = () => {
      log(PREFIX, 'CesiumJS script loaded successfully');
      resolve();
    };
    script.onerror = (err) => {
      error(PREFIX, 'Failed to load CesiumJS script:', err);
      reject(err);
    };
    document.head.appendChild(script);
  });

  log(PREFIX, 'CesiumJS initialized');
  return window.Cesium;
}

/**
 * Create and show loading indicator
 * @param {HTMLElement} container - Container element
 * @param {boolean} hasToken - Whether Ion token is provided
 * @returns {HTMLElement} Loading div element
 */
export function createLoadingIndicator(container, hasToken) {
  const loadingDiv = document.createElement("div");
  loadingDiv.textContent = "Loading CesiumJS...";
  loadingDiv.style.cssText = "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 18px; color: #fff; background: rgba(0,0,0,0.7); padding: 20px; border-radius: 5px;";

  if (!hasToken) {
    loadingDiv.innerHTML = `
      <div style="text-align: center;">
        <div>Loading CesiumJS...</div>
        <div style="font-size: 12px; margin-top: 10px; color: #ffa500;">
          ⚠️ No Cesium Ion token set<br>
          Some features may not work
        </div>
      </div>
    `;
  }

  container.appendChild(loadingDiv);
  return loadingDiv;
}

/**
 * Initialize Cesium Viewer with configuration from model
 * @param {HTMLElement} container - Container element
 * @param {Object} model - Anywidget traitlet model
 * @param {Object} Cesium - Cesium global object
 * @returns {Object} Cesium Viewer instance
 */
export function createViewer(container, model, Cesium) {
  log(PREFIX, 'Creating viewer with options...');
  const viewerOptions = {
    timeline: model.get("show_timeline"),
    animation: model.get("show_animation"),
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
  log(PREFIX, 'Viewer options:', viewerOptions);

  if (model.get("enable_terrain")) {
    viewerOptions.terrain = Cesium.Terrain.fromWorldTerrain();
    log(PREFIX, 'Terrain enabled');
  }

  const viewer = new Cesium.Viewer(container, viewerOptions);
  viewer.scene.globe.enableLighting = model.get("enable_lighting");
  log(PREFIX, 'Viewer created, lighting:', model.get("enable_lighting"));

  return viewer;
}

/**
 * Setup dynamic model listeners for viewer configuration changes
 * @param {Object} viewer - Cesium Viewer instance
 * @param {Object} model - Anywidget traitlet model
 * @param {HTMLElement} container - Container element
 * @param {Object} Cesium - Cesium global object
 */
export function setupViewerListeners(viewer, model, container, Cesium) {
  log(PREFIX, 'Setting up viewer listeners');
  let isDestroyed = false;
  let scrubTimeout = null;

  model.on("change:enable_terrain", () => {
    if (isDestroyed) {
      log(PREFIX, 'Skipping enable_terrain change - destroyed');
      return;
    }
    if (!viewer) return;
    log(PREFIX, 'Terrain setting changed:', model.get("enable_terrain"));
    if (model.get("enable_terrain")) {
      viewer.scene.setTerrain(Cesium.Terrain.fromWorldTerrain());
    } else {
      viewer.scene.setTerrain(undefined);
    }
  });

  model.on("change:enable_lighting", () => {
    if (isDestroyed) return;
    if (!viewer) return;
    log(PREFIX, 'Lighting setting changed:', model.get("enable_lighting"));
    viewer.scene.globe.enableLighting = model.get("enable_lighting");
  });

  model.on("change:height", () => {
    if (isDestroyed) return;
    if (!viewer) return;
    log(PREFIX, 'Height changed:', model.get("height"));
    container.style.height = model.get("height");
    viewer.resize();
  });

  model.on("change:show_timeline", () => {
    if (isDestroyed) return;
    if (!viewer || !viewer.timeline) return;
    log(PREFIX, 'Timeline visibility changed:', model.get("show_timeline"));
    viewer.timeline.container.style.visibility = model.get("show_timeline") ? "visible" : "hidden";
  });

  model.on("change:show_animation", () => {
    if (isDestroyed) return;
    if (!viewer || !viewer.animation) return;
    log(PREFIX, 'Animation visibility changed:', model.get("show_animation"));
    viewer.animation.container.style.visibility = model.get("show_animation") ? "visible" : "hidden";
  });

  // Setup atmosphere settings listener
  model.on("change:atmosphere_settings", () => {
    if (isDestroyed) return;
    if (!viewer || !viewer.scene || !viewer.scene.atmosphere) return;
    
    const settings = model.get("atmosphere_settings");
    if (!settings || Object.keys(settings).length === 0) return;
    
    log(PREFIX, 'Atmosphere settings changed:', settings);
    const atmosphere = viewer.scene.atmosphere;
    
    // Apply each setting if provided
    if (settings.brightnessShift !== undefined) {
      atmosphere.brightnessShift = settings.brightnessShift;
    }
    if (settings.hueShift !== undefined) {
      atmosphere.hueShift = settings.hueShift;
    }
    if (settings.saturationShift !== undefined) {
      atmosphere.saturationShift = settings.saturationShift;
    }
    if (settings.lightIntensity !== undefined) {
      atmosphere.lightIntensity = settings.lightIntensity;
    }
    if (settings.rayleighCoefficient !== undefined && Array.isArray(settings.rayleighCoefficient) && settings.rayleighCoefficient.length === 3) {
      atmosphere.rayleighCoefficient = new Cesium.Cartesian3(
        settings.rayleighCoefficient[0],
        settings.rayleighCoefficient[1],
        settings.rayleighCoefficient[2]
      );
    }
    if (settings.rayleighScaleHeight !== undefined) {
      atmosphere.rayleighScaleHeight = settings.rayleighScaleHeight;
    }
    if (settings.mieCoefficient !== undefined && Array.isArray(settings.mieCoefficient) && settings.mieCoefficient.length === 3) {
      atmosphere.mieCoefficient = new Cesium.Cartesian3(
        settings.mieCoefficient[0],
        settings.mieCoefficient[1],
        settings.mieCoefficient[2]
      );
    }
    if (settings.mieScaleHeight !== undefined) {
      atmosphere.mieScaleHeight = settings.mieScaleHeight;
    }
    if (settings.mieAnisotropy !== undefined) {
      atmosphere.mieAnisotropy = settings.mieAnisotropy;
    }
  });

  // Setup sky atmosphere settings listener
  model.on("change:sky_atmosphere_settings", () => {
    if (isDestroyed) return;
    if (!viewer || !viewer.scene || !viewer.scene.skyAtmosphere) return;
    
    const settings = model.get("sky_atmosphere_settings");
    if (!settings || Object.keys(settings).length === 0) return;
    
    log(PREFIX, 'Sky atmosphere settings changed:', settings);
    const skyAtmosphere = viewer.scene.skyAtmosphere;
    
    // Apply each setting if provided
    if (settings.show !== undefined) {
      skyAtmosphere.show = settings.show;
    }
    if (settings.brightnessShift !== undefined) {
      skyAtmosphere.brightnessShift = settings.brightnessShift;
    }
    if (settings.hueShift !== undefined) {
      skyAtmosphere.hueShift = settings.hueShift;
    }
    if (settings.saturationShift !== undefined) {
      skyAtmosphere.saturationShift = settings.saturationShift;
    }
    if (settings.atmosphereLightIntensity !== undefined) {
      skyAtmosphere.atmosphereLightIntensity = settings.atmosphereLightIntensity;
    }
    if (settings.atmosphereRayleighCoefficient !== undefined && Array.isArray(settings.atmosphereRayleighCoefficient) && settings.atmosphereRayleighCoefficient.length === 3) {
      skyAtmosphere.atmosphereRayleighCoefficient = new Cesium.Cartesian3(
        settings.atmosphereRayleighCoefficient[0],
        settings.atmosphereRayleighCoefficient[1],
        settings.atmosphereRayleighCoefficient[2]
      );
    }
    if (settings.atmosphereRayleighScaleHeight !== undefined) {
      skyAtmosphere.atmosphereRayleighScaleHeight = settings.atmosphereRayleighScaleHeight;
    }
    if (settings.atmosphereMieCoefficient !== undefined && Array.isArray(settings.atmosphereMieCoefficient) && settings.atmosphereMieCoefficient.length === 3) {
      skyAtmosphere.atmosphereMieCoefficient = new Cesium.Cartesian3(
        settings.atmosphereMieCoefficient[0],
        settings.atmosphereMieCoefficient[1],
        settings.atmosphereMieCoefficient[2]
      );
    }
    if (settings.atmosphereMieScaleHeight !== undefined) {
      skyAtmosphere.atmosphereMieScaleHeight = settings.atmosphereMieScaleHeight;
    }
    if (settings.atmosphereMieAnisotropy !== undefined) {
      skyAtmosphere.atmosphereMieAnisotropy = settings.atmosphereMieAnisotropy;
    }
    if (settings.perFragmentAtmosphere !== undefined) {
      skyAtmosphere.perFragmentAtmosphere = settings.perFragmentAtmosphere;
    }
  });

  // SkyBox settings listener
  model.on("change:skybox_settings", () => {
    if (isDestroyed) return;
    if (!viewer || !viewer.scene || !viewer.scene.skyBox) return;
    
    const settings = model.get("skybox_settings");
    if (!settings || Object.keys(settings).length === 0) return;
    
    log(PREFIX, 'SkyBox settings changed:', settings);
    const skyBox = viewer.scene.skyBox;
    
    // Apply show setting
    if (settings.show !== undefined) {
      skyBox.show = settings.show;
    }
    
    // Apply custom sources if provided
    if (settings.sources !== undefined && settings.sources !== null) {
      const sources = settings.sources;
      
      // Create new skybox with custom sources
      if (sources.positiveX && sources.negativeX && 
          sources.positiveY && sources.negativeY && 
          sources.positiveZ && sources.negativeZ) {
        
        viewer.scene.skyBox = new Cesium.SkyBox({
          sources: {
            positiveX: sources.positiveX,
            negativeX: sources.negativeX,
            positiveY: sources.positiveY,
            negativeY: sources.negativeY,
            positiveZ: sources.positiveZ,
            negativeZ: sources.negativeZ
          }
        });
        
        // Preserve show setting if it was specified
        if (settings.show !== undefined) {
          viewer.scene.skyBox.show = settings.show;
        }
      }
    }
  });

  // Helper function to get current camera state
  function getCameraState() {
    if (!viewer || !viewer.camera || !viewer.camera.positionCartographic) {
      warn(PREFIX, 'Cannot get camera state - viewer or camera not available');
      return null;
    }
    try {
      const cartographic = viewer.camera.positionCartographic;
      return {
        latitude: Cesium.Math.toDegrees(cartographic.latitude),
        longitude: Cesium.Math.toDegrees(cartographic.longitude),
        altitude: cartographic.height,
        heading: Cesium.Math.toDegrees(viewer.camera.heading),
        pitch: Cesium.Math.toDegrees(viewer.camera.pitch),
        roll: Cesium.Math.toDegrees(viewer.camera.roll)
      };
    } catch (error) {
      warn(PREFIX, 'Error getting camera state:', error);
      return null;
    }
  }

  // Helper function to get clock state
  function getClockState() {
    if (!viewer || !viewer.clock) return null;
    try {
      return {
        current_time: Cesium.JulianDate.toIso8601(viewer.clock.currentTime),
        multiplier: viewer.clock.multiplier,
        is_animating: viewer.clock.shouldAnimate
      };
    } catch (error) {
      warn(PREFIX, 'Error getting clock state:', error);
      return null;
    }
  }

  // Helper function to send interaction event
  function sendInteractionEvent(type, additionalData = {}) {
    if (isDestroyed) {
      log(PREFIX, 'Skipping interaction event - destroyed:', type);
      return;
    }
    if (!viewer) {
      warn(PREFIX, 'Cannot send interaction event - viewer not available');
      return;
    }
    
    const cameraState = getCameraState();
    if (!cameraState) {
      warn(PREFIX, 'Skipping interaction event - camera state not available');
      return;
    }
    
    const event = {
      type: type,
      timestamp: new Date().toISOString(),
      camera: cameraState,
      clock: getClockState(),
      ...additionalData
    };
    
    log(PREFIX, 'Interaction event:', type, event);
    model.set("interaction_event", event);
    model.save_changes();
  }

  // Track camera movement end
  const camera = viewer.camera;
  camera.moveEnd.addEventListener(() => {
    if (isDestroyed || !viewer) return;
    sendInteractionEvent('camera_move');
  });

  // Track mouse clicks with picked position/entity
  const scene = viewer.scene;
  const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
  
  handler.setInputAction((click) => {
    if (isDestroyed || !viewer || !viewer.scene || !viewer.camera) return;
    
    const pickedData = {};
    
    // Try to get picked position
    try {
      const ray = viewer.camera.getPickRay(click.position);
      if (ray && viewer.scene.globe) {
        const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        if (cartesian) {
          const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
          pickedData.picked_position = {
            latitude: Cesium.Math.toDegrees(cartographic.latitude),
            longitude: Cesium.Math.toDegrees(cartographic.longitude),
            altitude: cartographic.height
          };
        }
      }
    } catch (error) {
      warn(PREFIX, 'Error picking position:', error);
    }
    
    // Try to get picked entity
    try {
      const pickedObject = viewer.scene.pick(click.position);
      if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
        const entity = pickedObject.id;
        pickedData.picked_entity = {
          id: entity.id,
          name: entity.name || null
        };
        
        // Add entity properties if available
        if (entity.properties) {
          const props = {};
          const propertyNames = entity.properties.propertyNames;
          if (propertyNames && propertyNames.length > 0) {
            propertyNames.forEach(name => {
              try {
                props[name] = entity.properties[name].getValue(viewer.clock.currentTime);
              } catch (e) {
                // Skip properties that can't be evaluated
              }
            });
            if (Object.keys(props).length > 0) {
              pickedData.picked_entity.properties = props;
            }
          }
        }
      }
    } catch (error) {
      warn(PREFIX, 'Error picking entity:', error);
    }
    
    sendInteractionEvent('left_click', pickedData);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  handler.setInputAction((click) => {
    if (isDestroyed || !viewer || !viewer.scene || !viewer.camera) return;
    
    const pickedData = {};
    
    // Try to get picked position
    try {
      const ray = viewer.camera.getPickRay(click.position);
      if (ray && viewer.scene.globe) {
        const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        if (cartesian) {
          const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
          pickedData.picked_position = {
            latitude: Cesium.Math.toDegrees(cartographic.latitude),
            longitude: Cesium.Math.toDegrees(cartographic.longitude),
            altitude: cartographic.height
          };
        }
      }
    } catch (error) {
      warn(PREFIX, 'Error picking position:', error);
    }
    
    sendInteractionEvent('right_click', pickedData);
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

  // Track timeline scrubbing (if timeline exists)
  if (viewer.timeline) {
    let timelineScrubbing = false;
    
    // Listen to clock changes to detect timeline interaction
    viewer.clock.onTick.addEventListener(() => {
      if (isDestroyed) return;
      if (viewer.timeline) {
        // Clear any existing timeout
        if (scrubTimeout) {
          clearTimeout(scrubTimeout);
          scrubTimeout = null;
        }
        
        // Set timeout to detect when scrubbing ends
        scrubTimeout = setTimeout(() => {
          if (!isDestroyed && timelineScrubbing) {
            timelineScrubbing = false;
            sendInteractionEvent('timeline_scrub');
          }
        }, 500); // 500ms after last change
        
        timelineScrubbing = true;
      }
    });
  }

  log(PREFIX, 'Viewer listeners setup complete');
}

/**
 * Setup GeoJSON data loading and management
 * @param {Object} viewer - Cesium Viewer instance
 * @param {Object} model - Anywidget traitlet model
 * @param {Object} Cesium - Cesium global object
 */
export function setupGeoJSONLoader(viewer, model, Cesium) {
  log(PREFIX, 'Setting up GeoJSON loader');
  let geojsonDataSources = [];
  let isDestroyed = false;

  // Function to load GeoJSON data
  async function loadGeoJSONData(flyToData = true) {
    if (isDestroyed) {
      log(PREFIX, 'Skipping geojson_data load - destroyed');
      return;
    }
    if (!viewer || !viewer.dataSources) {
      warn(PREFIX, 'Cannot load GeoJSON - viewer or dataSources not available');
      return;
    }
    const geojsonDataArray = model.get("geojson_data");
    log(PREFIX, 'Loading GeoJSON data, count:', geojsonDataArray?.length || 0);

    // Remove all existing GeoJSON data sources
    geojsonDataSources.forEach(dataSource => {
      if (viewer && viewer.dataSources) {
        viewer.dataSources.remove(dataSource);
      }
    });
    geojsonDataSources = [];

    // Load each GeoJSON dataset
    if (geojsonDataArray && Array.isArray(geojsonDataArray)) {
      for (const geojsonData of geojsonDataArray) {
        try {
          log(PREFIX, 'Loading GeoJSON dataset...');
          const dataSource = await Cesium.GeoJsonDataSource.load(geojsonData, {
            stroke: Cesium.Color.HOTPINK,
            fill: Cesium.Color.PINK.withAlpha(0.5),
            strokeWidth: 3,
          });
          // Check viewer still exists after async operation
          if (viewer && viewer.dataSources) {
            viewer.dataSources.add(dataSource);
            geojsonDataSources.push(dataSource);
            log(PREFIX, 'GeoJSON dataset loaded successfully');
          }
        } catch (error) {
          error(PREFIX, "Error loading GeoJSON:", error);
        }
      }
      
      // Fly to the first data source if any were loaded
      if (flyToData && geojsonDataSources.length > 0 && viewer && viewer.flyTo) {
        log(PREFIX, 'Flying to GeoJSON data');
        viewer.flyTo(geojsonDataSources[0]);
      }
    }
  }

  // Listen for changes to geojson_data
  model.on("change:geojson_data", () => loadGeoJSONData(true));

  // Load any initial GeoJSON data
  const initialData = model.get("geojson_data");
  if (initialData && Array.isArray(initialData) && initialData.length > 0) {
    log(PREFIX, 'Loading initial GeoJSON data...');
    loadGeoJSONData(true);
  }

  return {
    destroy: () => {
      log(PREFIX, 'Destroying GeoJSON loader');
      isDestroyed = true;
      geojsonDataSources.forEach(dataSource => {
        if (viewer) {
          viewer.dataSources.remove(dataSource);
        }
      });
      geojsonDataSources = [];
    }
  };
}

/**
 * Setup CZML data loading and management
 * @param {Object} viewer - Cesium Viewer instance
 * @param {Object} model - Anywidget traitlet model
 * @param {Object} Cesium - Cesium global object
 */
export function setupCZMLLoader(viewer, model, Cesium) {
  log(PREFIX, 'Setting up CZML loader');
  let czmlDataSources = [];
  let isDestroyed = false;

  // Function to load CZML data
  async function loadCZMLData(flyToData = true) {
    if (isDestroyed) {
      log(PREFIX, 'Skipping czml_data load - destroyed');
      return;
    }
    if (!viewer || !viewer.dataSources) {
      warn(PREFIX, 'Cannot load CZML - viewer or dataSources not available');
      return;
    }
    const czmlDataArray = model.get("czml_data");
    log(PREFIX, 'Loading CZML data, count:', czmlDataArray?.length || 0);

    // Remove all existing CZML data sources
    czmlDataSources.forEach(dataSource => {
      if (viewer && viewer.dataSources) {
        viewer.dataSources.remove(dataSource);
      }
    });
    czmlDataSources = [];

    // Load each CZML document
    if (czmlDataArray && Array.isArray(czmlDataArray)) {
      for (const czmlData of czmlDataArray) {
        if (Array.isArray(czmlData) && czmlData.length > 0) {
          try {
            log(PREFIX, 'Loading CZML document with', czmlData.length, 'packets...');
            const dataSource = await Cesium.CzmlDataSource.load(czmlData);
            // Check viewer still exists after async operation
            if (viewer && viewer.dataSources) {
              viewer.dataSources.add(dataSource);
              czmlDataSources.push(dataSource);
              log(PREFIX, 'CZML document loaded successfully, entities:', dataSource.entities.values.length);
            }
          } catch (error) {
            error(PREFIX, "Error loading CZML:", error);
          }
        } else {
          warn(PREFIX, 'Skipping invalid CZML data (not an array or empty):', czmlData);
        }
      }
      
      // Fly to the first data source if any were loaded
      if (flyToData && czmlDataSources.length > 0 && viewer && viewer.flyTo) {
        log(PREFIX, 'Flying to CZML data');
        viewer.flyTo(czmlDataSources[0]);
      }
    }
  }

  // Listen for changes to czml_data
  model.on("change:czml_data", () => loadCZMLData(true));

  // Load any initial CZML data
  const initialData = model.get("czml_data");
  if (initialData && Array.isArray(initialData) && initialData.length > 0) {
    log(PREFIX, 'Loading initial CZML data...');
    loadCZMLData(true);
  }

  return {
    destroy: () => {
      log(PREFIX, 'Destroying CZML loader');
      isDestroyed = true;
      czmlDataSources.forEach(dataSource => {
        if (viewer) {
          viewer.dataSources.remove(dataSource);
        }
      });
      czmlDataSources = [];
    }
  };
}
