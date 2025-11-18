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
  // Dynamically load CesiumJS from CDN
  const Cesium = await loadCesiumJS();
  
  // Create container div for Cesium viewer
  const container = document.createElement("div");
  container.style.width = "100%";
  container.style.height = model.get("height");
  container.style.position = "relative";
  el.appendChild(container);

  // Set Cesium Ion access token if provided
  const ionToken = model.get("ion_access_token");
  if (ionToken) {
    Cesium.Ion.defaultAccessToken = ionToken;
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
      // Initialize Cesium Viewer
      viewer = createViewer(container, model, Cesium);

      // Remove loading indicator
      if (loadingDiv.parentNode) {
        loadingDiv.remove();
      }

      // Initialize camera synchronization
      cameraSync = initializeCameraSync(viewer, model);

      // Initialize measurement tools
      measurementTools = initializeMeasurementTools(viewer, model, container);

      // Setup viewer configuration listeners
      setupViewerListeners(viewer, model, container, Cesium);

      // Setup GeoJSON data loader
      geoJsonLoader = setupGeoJSONLoader(viewer, model, Cesium);
      
      // Setup CZML data loader
      czmlLoader = setupCZMLLoader(viewer, model, Cesium);

    } catch (error) {
      console.error("Error initializing CesiumJS viewer:", error);
      loadingDiv.textContent = `Error: ${error.message}`;
      loadingDiv.style.background = "rgba(255,0,0,0.8)";
    }
  })();

  // Cleanup function called when widget is destroyed
  return () => {
    if (cameraSync) {
      cameraSync.destroy();
    }
    if (measurementTools) {
      measurementTools.destroy();
    }
    if (geoJsonLoader) {
      geoJsonLoader.destroy();
    }
    if (czmlLoader) {
      czmlLoader.destroy();
    }
    if (viewer) {
      viewer.destroy();
    }
  };
}

export default { render };
