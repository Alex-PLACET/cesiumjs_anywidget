/**
 * CesiumJS Anywidget - Main Entry Point
 * 
 * Orchestrates the initialization of CesiumJS viewer, camera synchronization,
 * and measurement tools by composing specialized modules.
 */

import { loadCesiumJS, createLoadingIndicator, createViewer, setupViewerListeners, setupGeoJSONLoader, setupCZMLLoader, setupPhotorealisticTiles } from './viewer-init.js';
import { initializeCameraSync } from './camera-sync.js';
import { initializeMeasurementTools } from './measurement-tools.js';
import { initializePointPicking } from './point-picking.js';
import { setDebugMode, log, warn, error } from './logger.js';

// Configure Cesium base URL for assets before loading
window.CESIUM_BASE_URL = "https://cesium.com/downloads/cesiumjs/releases/1.137/Build/Cesium/";

/**
 * Render function called by anywidget
 * @param {Object} context - Anywidget render context
 * @param {Object} context.model - Traitlet model for state synchronization
 * @param {HTMLElement} context.el - DOM element to render into
 */
async function render({ model, el }) {
  // Initialize debug mode from model
  setDebugMode(model.get("debug_mode") || false);
  
  // Listen for debug mode changes
  model.on("change:debug_mode", () => {
    setDebugMode(model.get("debug_mode"));
  });

  log('Main', 'Starting render');
  
  // Dynamically load CesiumJS from CDN
  log('Main', 'Loading CesiumJS...');
  const Cesium = await loadCesiumJS();
  log('Main', 'CesiumJS loaded successfully');

  // Create container div for Cesium viewer
  const container = document.createElement("div");
  container.style.width = "100%";
  container.style.height = model.get("height");
  container.style.position = "relative";
  el.appendChild(container);
  log('Main', 'Container created with height:', model.get("height"));

  // Set Cesium Ion access token if provided
  const ionToken = model.get("ion_access_token");
  if (ionToken) {
    Cesium.Ion.defaultAccessToken = ionToken;
    log('Main', 'Ion access token set');
  } else {
    warn('Main', 'No Ion access token provided');
  }

  // Add loading indicator
  const loadingDiv = createLoadingIndicator(container, !!ionToken);

  // Initialize viewer and modules
  let viewer = null;
  let cameraSync = null;
  let measurementTools = null;
  let pointPicking = null;
  let photoProjection = null;
  let geoJsonLoader = null;
  let czmlLoader = null;
  let photorealisticTiles = null;

  // Async initialization
  (async () => {
    try {
      log('Main', 'Creating Cesium Viewer...');
      // Initialize Cesium Viewer
      viewer = createViewer(container, model, Cesium);
      log('Main', 'Cesium Viewer created successfully');

      // Remove loading indicator
      if (loadingDiv.parentNode) {
        loadingDiv.remove();
      }

      log('Main', 'Initializing camera synchronization...');
      // Initialize camera synchronization
      cameraSync = initializeCameraSync(viewer, model);
      log('Main', 'Camera synchronization initialized');

      log('Main', 'Initializing measurement tools...');
      // Initialize measurement tools
      measurementTools = initializeMeasurementTools(viewer, model, container);
      log('Main', 'Measurement tools initialized');

      log('Main', 'Initializing point picking...');
      // Initialize point picking for camera calibration
      pointPicking = initializePointPicking(viewer, model, container);
      log('Main', 'Point picking initialized');

      log('Main', 'Setting up viewer listeners...');
      // Setup viewer configuration listeners
      setupViewerListeners(viewer, model, container, Cesium);
      log('Main', 'Viewer listeners set up');

      log('Main', 'Setting up GeoJSON loader...');
      // Setup GeoJSON data loader
      geoJsonLoader = setupGeoJSONLoader(viewer, model, Cesium);
      log('Main', 'GeoJSON loader set up');

      log('Main', 'Setting up CZML loader...');
      // Setup CZML data loader
      czmlLoader = setupCZMLLoader(viewer, model, Cesium);
      log('Main', 'CZML loader set up');

      log('Main', 'Setting up Photorealistic 3D Tiles...');
      // Setup Google Photorealistic 3D Tiles
      photorealisticTiles = setupPhotorealisticTiles(viewer, model, Cesium);
      log('Main', 'Photorealistic 3D Tiles set up');

      // Setup photo projection camera command listener
      model.on('change:camera_command', () => {
        const command = model.get('camera_command');
        if (command && command.command === 'projectPhoto' && photoProjection) {
          log('Main', 'Handling projectPhoto command');
          photoProjection.projectPhoto(command);
        }
      });

      log('Main', 'Initialization complete');
    } catch (err) {
      error('Main', 'Error initializing CesiumJS viewer:', err);
      loadingDiv.textContent = `Error: ${err.message}`;
      loadingDiv.style.background = "rgba(255,0,0,0.8)";
    }
  })();

  // Cleanup function called when widget is destroyed
  return () => {
    log('Main', 'Starting cleanup...');
    if (cameraSync) {
      log('Main', 'Destroying camera sync...');
      cameraSync.destroy();
    }
    if (measurementTools) {
      log('Main', 'Destroying measurement tools...');
      measurementTools.destroy();
    }
    if (photoProjection) {
      log('Main', 'Destroying photo projection...');
      photoProjection.destroy();
    }
    if (pointPicking) {
      log('Main', 'Destroying point picking...');
      pointPicking.destroy();
    }
    if (geoJsonLoader) {
      log('Main', 'Destroying GeoJSON loader...');
      geoJsonLoader.destroy();
    }
    if (czmlLoader) {
      log('Main', 'Destroying CZML loader...');
      czmlLoader.destroy();
    }
    if (photorealisticTiles) {
      log('Main', 'Destroying photorealistic tiles...');
      photorealisticTiles.destroy();
    }
    if (viewer) {
      log('Main', 'Destroying viewer...');
      viewer.destroy();
    }
    log('Main', 'Cleanup complete');
  };
}

export default { render };
