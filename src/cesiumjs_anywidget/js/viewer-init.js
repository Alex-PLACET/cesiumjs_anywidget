/**
 * Viewer Initialization Module
 * 
 * Handles CesiumJS viewer creation, configuration, and dynamic content loading
 * (terrain, lighting, GeoJSON).
 */

/**
 * Load CesiumJS library dynamically if not already loaded
 * @returns {Promise<Object>} Cesium global object
 */
export async function loadCesiumJS() {
  if (window.Cesium) {
    return window.Cesium;
  }

  const script = document.createElement('script');
  script.src = 'https://cesium.com/downloads/cesiumjs/releases/1.135/Build/Cesium/Cesium.js';

  await new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

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

  if (model.get("enable_terrain")) {
    viewerOptions.terrain = Cesium.Terrain.fromWorldTerrain();
  }

  const viewer = new Cesium.Viewer(container, viewerOptions);
  viewer.scene.globe.enableLighting = model.get("enable_lighting");

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
  model.on("change:enable_terrain", () => {
    if (!viewer) return;
    if (model.get("enable_terrain")) {
      viewer.scene.setTerrain(Cesium.Terrain.fromWorldTerrain());
    } else {
      viewer.scene.setTerrain(undefined);
    }
  });

  model.on("change:enable_lighting", () => {
    if (!viewer) return;
    viewer.scene.globe.enableLighting = model.get("enable_lighting");
  });

  model.on("change:height", () => {
    if (!viewer) return;
    container.style.height = model.get("height");
    viewer.resize();
  });

  model.on("change:show_timeline", () => {
    if (!viewer || !viewer.timeline) return;
    viewer.timeline.container.style.visibility = model.get("show_timeline") ? "visible" : "hidden";
  });

  model.on("change:show_animation", () => {
    if (!viewer || !viewer.animation) return;
    viewer.animation.container.style.visibility = model.get("show_animation") ? "visible" : "hidden";
  });

  // Setup atmosphere settings listener
  model.on("change:atmosphere_settings", () => {
    if (!viewer || !viewer.scene || !viewer.scene.atmosphere) return;
    
    const settings = model.get("atmosphere_settings");
    if (!settings || Object.keys(settings).length === 0) return;
    
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
    if (!viewer || !viewer.scene || !viewer.scene.skyAtmosphere) return;
    
    const settings = model.get("sky_atmosphere_settings");
    if (!settings || Object.keys(settings).length === 0) return;
    
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
    if (!viewer || !viewer.scene || !viewer.scene.skyBox) return;
    
    const settings = model.get("skybox_settings");
    if (!settings || Object.keys(settings).length === 0) return;
    
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
    const cartographic = viewer.camera.positionCartographic;
    return {
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      altitude: cartographic.height,
      heading: Cesium.Math.toDegrees(viewer.camera.heading),
      pitch: Cesium.Math.toDegrees(viewer.camera.pitch),
      roll: Cesium.Math.toDegrees(viewer.camera.roll)
    };
  }

  // Helper function to get clock state
  function getClockState() {
    if (!viewer.clock) return null;
    return {
      current_time: Cesium.JulianDate.toIso8601(viewer.clock.currentTime),
      multiplier: viewer.clock.multiplier,
      is_animating: viewer.clock.shouldAnimate
    };
  }

  // Helper function to send interaction event
  function sendInteractionEvent(type, additionalData = {}) {
    const event = {
      type: type,
      timestamp: new Date().toISOString(),
      camera: getCameraState(),
      clock: getClockState(),
      ...additionalData
    };
    
    console.log('[CesiumWidget] Interaction event:', type, event);
    model.set("interaction_event", event);
    model.save_changes();
  }

  // Track camera movement end
  const camera = viewer.camera;
  camera.moveEnd.addEventListener(() => {
    sendInteractionEvent('camera_move');
  });

  // Track mouse clicks with picked position/entity
  const scene = viewer.scene;
  const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
  
  handler.setInputAction((click) => {
    const pickedData = {};
    
    // Try to get picked position
    const ray = viewer.camera.getPickRay(click.position);
    const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
    if (cartesian) {
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      pickedData.picked_position = {
        latitude: Cesium.Math.toDegrees(cartographic.latitude),
        longitude: Cesium.Math.toDegrees(cartographic.longitude),
        altitude: cartographic.height
      };
    }
    
    // Try to get picked entity
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
    
    sendInteractionEvent('left_click', pickedData);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  handler.setInputAction((click) => {
    const pickedData = {};
    
    // Try to get picked position
    const ray = viewer.camera.getPickRay(click.position);
    const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
    if (cartesian) {
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      pickedData.picked_position = {
        latitude: Cesium.Math.toDegrees(cartographic.latitude),
        longitude: Cesium.Math.toDegrees(cartographic.longitude),
        altitude: cartographic.height
      };
    }
    
    sendInteractionEvent('right_click', pickedData);
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

  // Track timeline scrubbing (if timeline exists)
  if (viewer.timeline) {
    let timelineScrubbing = false;
    let scrubTimeout = null;
    
    // Listen to clock changes to detect timeline interaction
    viewer.clock.onTick.addEventListener(() => {
      if (viewer.timeline) {
        // Clear any existing timeout
        if (scrubTimeout) {
          clearTimeout(scrubTimeout);
        }
        
        // Set timeout to detect when scrubbing ends
        scrubTimeout = setTimeout(() => {
          if (timelineScrubbing) {
            timelineScrubbing = false;
            sendInteractionEvent('timeline_scrub');
          }
        }, 500); // 500ms after last change
        
        timelineScrubbing = true;
      }
    });
  }
}

/**
 * Setup GeoJSON data loading and management
 * @param {Object} viewer - Cesium Viewer instance
 * @param {Object} model - Anywidget traitlet model
 * @param {Object} Cesium - Cesium global object
 */
export function setupGeoJSONLoader(viewer, model, Cesium) {
  let geojsonDataSources = [];

  model.on("change:geojson_data", async () => {
    if (!viewer || !viewer.dataSources) return;
    const geojsonDataArray = model.get("geojson_data");

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
          const dataSource = await Cesium.GeoJsonDataSource.load(geojsonData, {
            stroke: Cesium.Color.HOTPINK,
            fill: Cesium.Color.PINK.withAlpha(0.5),
            strokeWidth: 3,
          });
          // Check viewer still exists after async operation
          if (viewer && viewer.dataSources) {
            viewer.dataSources.add(dataSource);
            geojsonDataSources.push(dataSource);
          }
        } catch (error) {
          console.error("Error loading GeoJSON:", error);
        }
      }
      
      // Fly to the first data source if any were loaded
      if (geojsonDataSources.length > 0 && viewer && viewer.flyTo) {
        viewer.flyTo(geojsonDataSources[0]);
      }
    }
  });

  return {
    destroy: () => {
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
  let czmlDataSources = [];

  model.on("change:czml_data", async () => {
    if (!viewer || !viewer.dataSources) return;
    const czmlDataArray = model.get("czml_data");

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
            const dataSource = await Cesium.CzmlDataSource.load(czmlData);
            // Check viewer still exists after async operation
            if (viewer && viewer.dataSources) {
              viewer.dataSources.add(dataSource);
              czmlDataSources.push(dataSource);
            }
          } catch (error) {
            console.error("Error loading CZML:", error);
          }
        }
      }
      
      // Fly to the first data source if any were loaded
      if (czmlDataSources.length > 0 && viewer && viewer.flyTo) {
        viewer.flyTo(czmlDataSources[0]);
      }
    }
  });

  return {
    destroy: () => {
      czmlDataSources.forEach(dataSource => {
        if (viewer) {
          viewer.dataSources.remove(dataSource);
        }
      });
      czmlDataSources = [];
    }
  };
}
