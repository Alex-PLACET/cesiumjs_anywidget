/**
 * Viewer Initialization Module
 * 
 * Handles CesiumJS viewer creation, configuration, and dynamic content loading
 * (terrain, lighting, GeoJSON).
 */

import { log, warn, error } from './logger.js';

const PREFIX = 'ViewerInit';

// ============= CONSTANTS =============

export const CESIUM_CDN_VERSION = '1.138';

const CONSTANTS = {
  // CesiumJS CDN
  CESIUM_CDN_VERSION,

  // Render Policy
  RUNNING_TARGET_FPS: 60,
  
  // Interaction Timing
  TIMELINE_SCRUB_DEBOUNCE_MS: 500,
  
  // GeoJSON Defaults
  GEOJSON_STROKE_WIDTH: 3,
  GEOJSON_FILL_ALPHA: 0.5,
};

/**
 * Patch the global Worker constructor to wrap cross-origin URLs in blob: URLs.
 *
 * JupyterLite (and similar environments) enforce a CSP of the form
 *   worker-src 'self' blob:
 * which means workers created directly from a CDN URL (e.g.
 * https://cesium.com/.../Workers/createVerticesFromHeightmap.js) are blocked.
 *
 * This patch intercepts those URLs and produces a tiny blob script that calls
 * importScripts(<original-url>), converting the origin to blob: which is
 * explicitly allowed.  importScripts() inside a worker is governed by
 * script-src, not worker-src, so it still reaches the CDN.
 *
 * Must be called before loading CesiumJS.
 */
export function patchWorkerForCSP() {
  if (typeof window === 'undefined' || !window.Worker) return;
  if (window.__workerCSPPatched) return; // avoid double-patching

  const OriginalWorker = window.Worker;
  const origin = window.location.origin;

  function PatchedWorker(url, options) {
    if (typeof url === 'string' && url.startsWith('http') && !url.startsWith(origin)) {
      const blob = new Blob(
        [`importScripts('${url}')`],
        { type: 'application/javascript' }
      );
      url = URL.createObjectURL(blob);
    }
    return new OriginalWorker(url, options);
  }

  PatchedWorker.prototype = OriginalWorker.prototype;
  window.Worker = PatchedWorker;
  window.__workerCSPPatched = true;
  log(PREFIX, 'Worker patched for CSP blob: compatibility');
}

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

  // Inject Cesium CSS link if not already present
  const cesiumCssId = 'cesium-widgets-css';
  if (!document.getElementById(cesiumCssId)) {
    const link = document.createElement('link');
    link.id = cesiumCssId;
    link.rel = 'stylesheet';
    link.href = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_CDN_VERSION}/Build/Cesium/Widgets/widgets.css`;
    document.head.appendChild(link);
  }

  const script = document.createElement('script');
  script.src = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_CDN_VERSION}/Build/Cesium/Cesium.js`;
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
  const shouldAnimate = model.get("should_animate") === true;
  const requestRenderMode = shouldAnimate ? false : (model.get("request_render_mode") ?? true);
  const maximumRenderTimeChange = model.get("maximum_render_time_change") ?? (
    shouldAnimate ? 0.0 : Number.POSITIVE_INFINITY
  );
  const viewerOptions = {
    timeline: model.get("show_timeline"),
    animation: model.get("show_animation"),
    requestRenderMode,
    maximumRenderTimeChange,
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
  
  // Control globe visibility (typically disabled when using photorealistic tiles)
  const showGlobe = model.get("show_globe");
  if (showGlobe === false) {
    viewerOptions.globe = false;
    log(PREFIX, 'Globe disabled (typically for photorealistic tiles)');
  }
  
  log(PREFIX, 'Viewer options:', viewerOptions);

  if (model.get("enable_terrain") && showGlobe !== false) {
    viewerOptions.terrain = Cesium.Terrain.fromWorldTerrain();
    log(PREFIX, 'Terrain enabled');
  }

  const viewer = new Cesium.Viewer(container, viewerOptions);
  
  // Only configure globe if it exists
  if (viewer.scene.globe) {
    viewer.scene.globe.enableLighting = model.get("enable_lighting");
    log(PREFIX, 'Viewer created, lighting:', model.get("enable_lighting"));
  } else {
    log(PREFIX, 'Viewer created without globe');
  }

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
  let isApplyingRunningPolicy = false;

  function requestSceneRender() {
    if (!viewer || !viewer.scene || !viewer.scene.requestRender) return;
    viewer.scene.requestRender();
  }

  function resolveMaximumRenderTimeChange() {
    const configured = model.get("maximum_render_time_change");
    if (configured !== undefined && configured !== null) {
      return configured;
    }
    return viewer.clock?.shouldAnimate ? 0.0 : Number.POSITIVE_INFINITY;
  }

  function applyAnimationRenderPolicy(isAnimating) {
    if (!viewer || !viewer.scene) return;

    if (isApplyingRunningPolicy === isAnimating) return;

    if (isAnimating) {
      viewer.scene.requestRenderMode = false;
      viewer.scene.maximumRenderTimeChange = 0.0;
      viewer.targetFrameRate = CONSTANTS.RUNNING_TARGET_FPS;
      isApplyingRunningPolicy = true;
      log(PREFIX, 'Applied running render policy:', {
        requestRenderMode: viewer.scene.requestRenderMode,
        maximumRenderTimeChange: viewer.scene.maximumRenderTimeChange,
        targetFrameRate: viewer.targetFrameRate,
      });
      return;
    }

    viewer.scene.requestRenderMode = model.get("request_render_mode") ?? true;
    viewer.scene.maximumRenderTimeChange = resolveMaximumRenderTimeChange();
    viewer.targetFrameRate = undefined;
    isApplyingRunningPolicy = false;
    log(PREFIX, 'Applied paused render policy:', {
      requestRenderMode: viewer.scene.requestRenderMode,
      maximumRenderTimeChange: viewer.scene.maximumRenderTimeChange,
      targetFrameRate: viewer.targetFrameRate,
    });
  }

  model.on("change:request_render_mode", () => {
    if (isDestroyed) return;
    if (!viewer || !viewer.scene) return;

    const isAnimating = viewer.clock?.shouldAnimate === true;
    applyAnimationRenderPolicy(isAnimating);
    log(PREFIX, 'requestRenderMode changed, animating:', isAnimating);
    if (!isAnimating) {
      requestSceneRender();
    }
  });

  model.on("change:maximum_render_time_change", () => {
    if (isDestroyed) return;
    if (!viewer || !viewer.scene) return;

    const isAnimating = viewer.clock?.shouldAnimate === true;
    applyAnimationRenderPolicy(isAnimating);
    log(PREFIX, 'maximumRenderTimeChange changed, animating:', isAnimating);
    if (!isAnimating) {
      requestSceneRender();
    }
  });

  model.on("change:request_render_trigger", () => {
    if (isDestroyed) return;
    log(PREFIX, 'Explicit render requested from Python');
    requestSceneRender();
  });

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
    requestSceneRender();
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
    requestSceneRender();
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
    requestSceneRender();
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
    requestSceneRender();
  });

  // ============= Clock/Timeline Initialization and Listeners =============

  // Initialize clock with current_time if provided
  const initialTime = model.get("current_time");
  if (initialTime && viewer.clock) {
    try {
      const julianDate = Cesium.JulianDate.fromIso8601(initialTime);
      viewer.clock.currentTime = julianDate;
      viewer.clock.startTime = julianDate.clone();
      viewer.clock.stopTime = Cesium.JulianDate.addDays(julianDate.clone(), 1, new Cesium.JulianDate());
      log(PREFIX, 'Clock initialized with time:', initialTime);
    } catch (err) {
      warn(PREFIX, 'Failed to parse initial time:', initialTime, err);
    }
  }

  // Initialize clock multiplier
  const initialMultiplier = model.get("clock_multiplier");
  if (initialMultiplier !== undefined && viewer.clock) {
    viewer.clock.multiplier = initialMultiplier;
    log(PREFIX, 'Clock multiplier initialized:', initialMultiplier);
  }

  // Initialize animation state
  const initialAnimate = model.get("should_animate");
  if (initialAnimate !== undefined && viewer.clock) {
    viewer.clock.shouldAnimate = initialAnimate;
    log(PREFIX, 'Clock animation initialized:', initialAnimate);
  }

  applyAnimationRenderPolicy(viewer.clock?.shouldAnimate === true);

  // Listen for current_time changes
  model.on("change:current_time", () => {
    if (isDestroyed) return;
    if (!viewer || !viewer.clock) return;
    
    const timeStr = model.get("current_time");
    if (!timeStr) return;
    
    try {
      const julianDate = Cesium.JulianDate.fromIso8601(timeStr);
      viewer.clock.currentTime = julianDate;
      log(PREFIX, 'Clock time updated:', timeStr);
      requestSceneRender();
    } catch (err) {
      warn(PREFIX, 'Failed to parse time:', timeStr, err);
    }
  });

  // Listen for clock_multiplier changes
  model.on("change:clock_multiplier", () => {
    if (isDestroyed) return;
    if (!viewer || !viewer.clock) return;
    
    const multiplier = model.get("clock_multiplier");
    if (multiplier !== undefined) {
      viewer.clock.multiplier = multiplier;
      log(PREFIX, 'Clock multiplier updated:', multiplier);
      requestSceneRender();
    }
  });

  // Listen for should_animate changes
  model.on("change:should_animate", () => {
    if (isDestroyed) return;
    if (!viewer || !viewer.clock) return;
    
    const shouldAnimate = model.get("should_animate");
    if (shouldAnimate !== undefined) {
      viewer.clock.shouldAnimate = shouldAnimate;
      applyAnimationRenderPolicy(shouldAnimate === true);
      log(PREFIX, 'Clock animation updated:', shouldAnimate);
      if (!shouldAnimate) {
        requestSceneRender();
      }
    }
  });

  // Listen for clock commands
  model.on("change:clock_command", () => {
    if (isDestroyed) return;
    if (!viewer || !viewer.clock) return;
    
    const command = model.get("clock_command");
    if (!command || !command.command) return;
    
    log(PREFIX, 'Clock command received:', command.command);
    
    switch (command.command) {
      case 'setTime':
        if (command.time) {
          try {
            const julianDate = Cesium.JulianDate.fromIso8601(command.time);
            viewer.clock.currentTime = julianDate;
            log(PREFIX, 'Clock time set via command:', command.time);
            requestSceneRender();
          } catch (err) {
            warn(PREFIX, 'Failed to parse time in command:', command.time, err);
          }
        }
        break;
        
      case 'play':
        viewer.clock.shouldAnimate = true;
        applyAnimationRenderPolicy(true);
        log(PREFIX, 'Clock animation started');
        break;
        
      case 'pause':
        viewer.clock.shouldAnimate = false;
        applyAnimationRenderPolicy(false);
        log(PREFIX, 'Clock animation paused');
        requestSceneRender();
        break;
        
      case 'setMultiplier':
        if (command.multiplier !== undefined) {
          viewer.clock.multiplier = command.multiplier;
          log(PREFIX, 'Clock multiplier set via command:', command.multiplier);
          requestSceneRender();
        }
        break;
        
      case 'setRange':
        if (command.startTime && command.stopTime) {
          try {
            const startDate = Cesium.JulianDate.fromIso8601(command.startTime);
            const stopDate = Cesium.JulianDate.fromIso8601(command.stopTime);
            viewer.clock.startTime = startDate;
            viewer.clock.stopTime = stopDate;
            log(PREFIX, 'Clock range set via command:', command.startTime, 'to', command.stopTime);
            requestSceneRender();
          } catch (err) {
            warn(PREFIX, 'Failed to parse time range in command:', err);
          }
        }
        break;
        
      default:
        warn(PREFIX, 'Unknown clock command:', command.command);
    }
  });

  // CZML entity update listener
  model.on("change:czml_entity_update", () => {
    if (isDestroyed) return;
    if (!viewer || !viewer.dataSources) return;
    
    const update = model.get("czml_entity_update");
    if (!update || !update.entity_id || !update.properties) return;
    
    log(PREFIX, 'CZML entity update:', update);
    
    // Find the entity in all data sources
    let entity = null;
    for (let i = 0; i < viewer.dataSources.length; i++) {
      const dataSource = viewer.dataSources.get(i);
      if (dataSource instanceof Cesium.CzmlDataSource) {
        entity = dataSource.entities.getById(update.entity_id);
        if (entity) break;
      }
    }
    
    if (!entity) {
      warn(PREFIX, 'Entity not found:', update.entity_id);
      return;
    }
    
    // Apply property updates
    const props = update.properties;
    
    // Update orientation (heading, pitch, roll)
    if (props.orientation && !props.position) {
      // Only update orientation if position wasn't also updated (position update handles both)
      const heading = Cesium.Math.toRadians(props.orientation.heading ?? 0);
      const pitch = Cesium.Math.toRadians(props.orientation.pitch ?? 0);
      const roll = Cesium.Math.toRadians(props.orientation.roll ?? 0);
      const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
      
      if (entity.position) {
        // Get current position
        const position = entity.position.getValue(viewer.clock.currentTime);
        if (position) {
          // Create orientation from HPR
          const orientation = Cesium.Transforms.headingPitchRollQuaternion(
            position,
            hpr
          );
          entity.orientation = new Cesium.ConstantProperty(orientation);
          log(PREFIX, 'Updated entity orientation:', props.orientation);
        } else {
          warn(PREFIX, 'Cannot update orientation - no valid position');
        }
      } else {
        warn(PREFIX, 'Cannot update orientation - entity has no position');
      }
    }
    
    // Update position (latitude, longitude, altitude)
    if (props.position) {
      const lat = Cesium.Math.toRadians(props.position.latitude);
      const lon = Cesium.Math.toRadians(props.position.longitude);
      const alt = props.position.altitude ?? 0;
      const position = Cesium.Cartesian3.fromRadians(lon, lat, alt);
      entity.position = new Cesium.ConstantPositionProperty(position);
      log(PREFIX, 'Updated entity position:', props.position);
      
      // If orientation was also requested, recompute it with new position
      if (props.orientation && entity.orientation) {
        const heading = Cesium.Math.toRadians(props.orientation.heading ?? 0);
        const pitch = Cesium.Math.toRadians(props.orientation.pitch ?? 0);
        const roll = Cesium.Math.toRadians(props.orientation.roll ?? 0);
        const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
        const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
        entity.orientation = new Cesium.ConstantProperty(orientation);
        log(PREFIX, 'Updated entity orientation after position change:', props.orientation);
      }
    }
    
    // Update other properties dynamically
    for (const [key, value] of Object.entries(props)) {
      if (key !== 'orientation' && key !== 'position' && entity[key] !== undefined) {
        try {
          if (typeof value === 'object' && value !== null) {
            // For complex properties, try to update sub-properties
            for (const [subKey, subValue] of Object.entries(value)) {
              if (entity[key][subKey] !== undefined) {
                entity[key][subKey] = new Cesium.ConstantProperty(subValue);
              }
            }
          } else {
            entity[key] = new Cesium.ConstantProperty(value);
          }
          log(PREFIX, `Updated entity ${key}:`, value);
        } catch (err) {
          warn(PREFIX, `Failed to update property ${key}:`, err);
        }
      }
    }

    requestSceneRender();
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

  // Helper function to get picked position from click
  function getPickedPosition(click) {
    if (!viewer || !viewer.camera || !viewer.scene || !viewer.scene.globe) {
      return null;
    }
    try {
      const ray = viewer.camera.getPickRay(click.position);
      if (!ray) return null;
      
      const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
      if (!cartesian) return null;
      
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      return {
        latitude: Cesium.Math.toDegrees(cartographic.latitude),
        longitude: Cesium.Math.toDegrees(cartographic.longitude),
        altitude: cartographic.height
      };
    } catch (error) {
      warn(PREFIX, 'Error picking position:', error);
      return null;
    }
  }

  // Helper function to get picked entity from click
  function getPickedEntity(click) {
    if (!viewer || !viewer.scene || !viewer.clock) {
      return null;
    }
    try {
      const pickedObject = viewer.scene.pick(click.position);
      if (!Cesium.defined(pickedObject) || !Cesium.defined(pickedObject.id)) {
        return null;
      }
      
      const entity = pickedObject.id;
      const entityData = {
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
            entityData.properties = props;
          }
        }
      }
      
      return entityData;
    } catch (error) {
      warn(PREFIX, 'Error picking entity:', error);
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
    
    const pickedPosition = getPickedPosition(click);
    if (pickedPosition) {
      pickedData.picked_position = pickedPosition;
    }
    
    const pickedEntity = getPickedEntity(click);
    if (pickedEntity) {
      pickedData.picked_entity = pickedEntity;
    }
    
    sendInteractionEvent('left_click', pickedData);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  handler.setInputAction((click) => {
    if (isDestroyed || !viewer || !viewer.scene || !viewer.camera) return;
    
    const pickedData = {};
    
    const pickedPosition = getPickedPosition(click);
    if (pickedPosition) {
      pickedData.picked_position = pickedPosition;
    }
    
    sendInteractionEvent('right_click', pickedData);
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

  // Track timeline scrubbing (if timeline exists)
  if (viewer.timeline) {
    let timelineScrubbing = false;
    let lastTimelineTime = viewer.clock?.currentTime ? Cesium.JulianDate.clone(viewer.clock.currentTime) : null;
    
    // Listen to clock changes to detect timeline interaction
    viewer.clock.onTick.addEventListener(() => {
      if (isDestroyed) return;
      const isAnimating = viewer.clock.shouldAnimate === true;

      // Keep render policy aligned with Cesium timeline controls (play/rewind/pause)
      // even when those controls do not round-trip through model listeners.
      applyAnimationRenderPolicy(isAnimating);

      if (viewer.timeline) {
        if (isAnimating) {
          // Avoid per-frame timeout churn while timeline playback is running.
          if (timelineScrubbing) {
            timelineScrubbing = false;
          }
          if (scrubTimeout) {
            clearTimeout(scrubTimeout);
            scrubTimeout = null;
          }
          return;
        }

        // Ensure manual timeline scrubbing renders even when animation is paused.
        if (!isAnimating && viewer.clock.currentTime) {
          if (!lastTimelineTime || !Cesium.JulianDate.equals(viewer.clock.currentTime, lastTimelineTime)) {
            requestSceneRender();
            lastTimelineTime = Cesium.JulianDate.clone(viewer.clock.currentTime);
          }
        }

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
        }, CONSTANTS.TIMELINE_SCRUB_DEBOUNCE_MS);
        
        timelineScrubbing = true;
      }
    });
  }

  log(PREFIX, 'Viewer listeners setup complete');

  // Return destroy method for cleanup
  return {
    destroy: () => {
      log(PREFIX, 'Destroying viewer listeners');
      isDestroyed = true;
      
      // Clear scrub timeout
      if (scrubTimeout) {
        clearTimeout(scrubTimeout);
        scrubTimeout = null;
      }
      
      // Destroy screen space event handler
      if (handler) {
        handler.destroy();
      }
      
      // Note: Traitlets model listeners cannot be easily removed
      // They will be garbage collected when model is destroyed
      // Camera moveEnd listener also cannot be removed in current Cesium API
      
      log(PREFIX, 'Viewer listeners destroyed');
    }
  };
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
            fill: Cesium.Color.PINK.withAlpha(CONSTANTS.GEOJSON_FILL_ALPHA),
            strokeWidth: CONSTANTS.GEOJSON_STROKE_WIDTH,
          });
          // Check viewer still exists and not destroyed after async operation
          if (!isDestroyed && viewer && viewer.dataSources) {
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
  
  // Store reference for external access
  viewer._czmlDataSources = czmlDataSources;

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
            if (!isDestroyed && viewer && viewer.dataSources) {
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

/**
 * Setup Google Photorealistic 3D Tiles loader
 * @param {Object} viewer - Cesium Viewer instance
 * @param {Object} model - Anywidget traitlet model
 * @param {Object} Cesium - Cesium global object
 * @returns {Object} Object with destroy method
 */
export function setupPhotorealisticTiles(viewer, model, Cesium) {
  log(PREFIX, 'Setting up Photorealistic 3D Tiles loader');
  let photorealisticTileset = null;
  let isDestroyed = false;
  
  /**
   * Load or remove Google Photorealistic 3D Tiles based on enabled state
   */
  async function updatePhotorealisticTiles() {
    if (isDestroyed) {
      log(PREFIX, 'Skipping photorealistic tiles update - destroyed');
      return;
    }
    if (!viewer || !viewer.scene || !viewer.scene.primitives) {
      warn(PREFIX, 'Cannot update photorealistic tiles - viewer not available');
      return;
    }
    
    const enabled = model.get("enable_photorealistic_tiles");
    log(PREFIX, 'Photorealistic tiles enabled:', enabled);
    
    // Remove existing tileset if present
    if (photorealisticTileset) {
      log(PREFIX, 'Removing existing photorealistic tileset');
      viewer.scene.primitives.remove(photorealisticTileset);
      photorealisticTileset = null;
    }
    
    // Load tileset if enabled
    if (enabled) {
      try {
        log(PREFIX, 'Creating Google Photorealistic 3D Tileset...');
        photorealisticTileset = await Cesium.createGooglePhotorealistic3DTileset();
        
        // Check viewer still exists after async operation
        if (viewer && viewer.scene && viewer.scene.primitives && !isDestroyed) {
          viewer.scene.primitives.add(photorealisticTileset);
          log(PREFIX, 'Google Photorealistic 3D Tileset loaded successfully');
        } else {
          log(PREFIX, 'Viewer destroyed during tileset load, skipping add');
          photorealisticTileset = null;
        }
      } catch (err) {
        error(PREFIX, 'Failed to load Google Photorealistic 3D Tileset:', err);
        photorealisticTileset = null;
      }
    }
  }
  
  // Listen for changes to enable_photorealistic_tiles
  model.on("change:enable_photorealistic_tiles", () => updatePhotorealisticTiles());
  
  // Load initial state
  if (model.get("enable_photorealistic_tiles")) {
    log(PREFIX, 'Loading initial photorealistic tiles...');
    updatePhotorealisticTiles();
  }
  
  return {
    destroy: () => {
      log(PREFIX, 'Destroying photorealistic tiles loader');
      isDestroyed = true;
      if (photorealisticTileset && viewer && viewer.scene && viewer.scene.primitives) {
        viewer.scene.primitives.remove(photorealisticTileset);
      }
      photorealisticTileset = null;
    }
  };
}
