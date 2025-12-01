/**
 * CesiumJS Anywidget - Main Entry Point
 * 
 * Orchestrates the initialization of CesiumJS viewer, camera synchronization,
 * and measurement tools by composing specialized modules.
 */

import { loadCesiumJS, createLoadingIndicator, createViewer, setupViewerListeners, setupGeoJSONLoader, setupCZMLLoader } from './viewer-init.js';
import { initializeCameraSync } from './camera-sync.js';
import { initializeMeasurementTools } from './measurement-tools.js';

// Configure Cesium base URL for assets before loading
window.CESIUM_BASE_URL = "https://cesium.com/downloads/cesiumjs/releases/1.135/Build/Cesium/";

/**
 * Render function called by anywidget
 * @param {Object} context - Anywidget render context
 * @param {Object} context.model - Traitlet model for state synchronization
 * @param {HTMLElement} context.el - DOM element to render into
 */
async function render({ model, el }) {
  console.log('[CesiumWidget] Starting render');
  
  // Dynamically load CesiumJS from CDN
  console.log('[CesiumWidget] Loading CesiumJS...');
  const Cesium = await loadCesiumJS();
  console.log('[CesiumWidget] CesiumJS loaded successfully');

  // Create container div for Cesium viewer
  const container = document.createElement("div");
  container.style.width = "100%";
  container.style.height = model.get("height");
  container.style.position = "relative";
  el.appendChild(container);
  console.log('[CesiumWidget] Container created with height:', model.get("height"));

  // Set Cesium Ion access token if provided
  const ionToken = model.get("ion_access_token");
  if (ionToken) {
    Cesium.Ion.defaultAccessToken = ionToken;
    console.log('[CesiumWidget] Ion access token set');
  } else {
    console.warn('[CesiumWidget] No Ion access token provided');
  }

  // Add loading indicator
  const loadingDiv = createLoadingIndicator(container, !!ionToken);

  // Initialize viewer and modules
  let viewer = null;
  let cameraSync = null;
  let measurementTools = null;
  let geoJsonLoader = null;
  let czmlLoader = null;

  // Async initialization
  (async () => {
    try {
      console.log('[CesiumWidget] Creating Cesium Viewer...');
      // Initialize Cesium Viewer
      viewer = createViewer(container, model, Cesium);
      console.log('[CesiumWidget] Cesium Viewer created successfully');

      // Remove loading indicator
      if (loadingDiv.parentNode) {
        loadingDiv.remove();
      }

      console.log('[CesiumWidget] Initializing camera synchronization...');
      // Initialize camera synchronization
      cameraSync = initializeCameraSync(viewer, model);
      console.log('[CesiumWidget] Camera synchronization initialized');

      console.log('[CesiumWidget] Initializing measurement tools...');
      // Initialize measurement tools
      measurementTools = initializeMeasurementTools(viewer, model, container);
      console.log('[CesiumWidget] Measurement tools initialized');

      console.log('[CesiumWidget] Setting up viewer listeners...');
      // Setup viewer configuration listeners
      setupViewerListeners(viewer, model, container, Cesium);
      console.log('[CesiumWidget] Viewer listeners set up');

      console.log('[CesiumWidget] Setting up GeoJSON loader...');
      // Setup GeoJSON data loader
      geoJsonLoader = setupGeoJSONLoader(viewer, model, Cesium);
      console.log('[CesiumWidget] GeoJSON loader set up');

      console.log('[CesiumWidget] Setting up CZML loader...');
      // Setup CZML data loader
      czmlLoader = setupCZMLLoader(viewer, model, Cesium);
      console.log('[CesiumWidget] CZML loader set up');

      console.log('[CesiumWidget] Initialization complete');
    } catch (error) {
      console.error("[CesiumWidget] Error initializing CesiumJS viewer:", error);
      loadingDiv.textContent = `Error: ${error.message}`;
      loadingDiv.style.background = "rgba(255,0,0,0.8)";
    }
  })();

  // Cleanup function called when widget is destroyed
  return () => {
    console.log('[CesiumWidget] Starting cleanup...');
    if (cameraSync) {
      console.log('[CesiumWidget] Destroying camera sync...');
      cameraSync.destroy();
    }
    if (measurementTools) {
      console.log('[CesiumWidget] Destroying measurement tools...');
      measurementTools.destroy();
    }
    if (geoJsonLoader) {
      console.log('[CesiumWidget] Destroying GeoJSON loader...');
      geoJsonLoader.destroy();
    }
    if (czmlLoader) {
      console.log('[CesiumWidget] Destroying CZML loader...');
      czmlLoader.destroy();
    }
    if (viewer) {
      console.log('[CesiumWidget] Destroying viewer...');
      viewer.destroy();
    }
    console.log('[CesiumWidget] Cleanup complete');
  };
}

export default { render };
