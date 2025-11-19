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
}

/**
 * Setup GeoJSON data loading and management
 * @param {Object} viewer - Cesium Viewer instance
 * @param {Object} model - Anywidget traitlet model
 * @param {Object} Cesium - Cesium global object
 */
export function setupGeoJSONLoader(viewer, model, Cesium) {
  let geojsonDataSource = null;

  model.on("change:geojson_data", async () => {
    if (!viewer) return;
    const geojsonData = model.get("geojson_data");

    if (geojsonDataSource) {
      viewer.dataSources.remove(geojsonDataSource);
      geojsonDataSource = null;
    }

    if (geojsonData) {
      try {
        geojsonDataSource = await Cesium.GeoJsonDataSource.load(geojsonData, {
          stroke: Cesium.Color.HOTPINK,
          fill: Cesium.Color.PINK.withAlpha(0.5),
          strokeWidth: 3,
        });
        viewer.dataSources.add(geojsonDataSource);
        viewer.flyTo(geojsonDataSource);
      } catch (error) {
        console.error("Error loading GeoJSON:", error);
      }
    }
  });

  return {
    destroy: () => {
      if (geojsonDataSource && viewer) {
        viewer.dataSources.remove(geojsonDataSource);
      }
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
  let czmlDataSource = null;

  model.on("change:czml_data", async () => {
    if (!viewer) return;
    const czmlData = model.get("czml_data");

    if (czmlDataSource) {
      viewer.dataSources.remove(czmlDataSource);
      czmlDataSource = null;
    }

    if (czmlData && Array.isArray(czmlData) && czmlData.length > 0) {
      try {
        czmlDataSource = await Cesium.CzmlDataSource.load(czmlData);
        viewer.dataSources.add(czmlDataSource);
        viewer.flyTo(czmlDataSource);
      } catch (error) {
        console.error("Error loading CZML:", error);
      }
    }
  });

  return {
    destroy: () => {
      if (czmlDataSource && viewer) {
        viewer.dataSources.remove(czmlDataSource);
      }
    }
  };
}
