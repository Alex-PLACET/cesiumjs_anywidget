/**
 * CesiumJS Anywidget - JavaScript render module
 * 
 * This module handles the CesiumJS viewer initialization and state synchronization
 * with the Python backend through the anywidget model.
 */

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
  if (!window.Cesium) {
    const script = document.createElement('script');
    script.src = 'https://cesium.com/downloads/cesiumjs/releases/1.135/Build/Cesium/Cesium.js';
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  const Cesium = window.Cesium;
  // Create container div for Cesium viewer
  const container = document.createElement("div");
  container.style.width = "100%";
  container.style.height = model.get("height");
  container.style.position = "relative";
  el.appendChild(container);

  // Add loading indicator
  const loadingDiv = document.createElement("div");
  loadingDiv.textContent = "Loading CesiumJS...";
  loadingDiv.style.cssText = "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 18px; color: #fff; background: rgba(0,0,0,0.7); padding: 20px; border-radius: 5px;";
  container.appendChild(loadingDiv);

  // Set Cesium Ion access token if provided
  const ionToken = model.get("ion_access_token");
  if (ionToken) {
    Cesium.Ion.defaultAccessToken = ionToken;
  } else {
    // Show warning in loading indicator if no token provided
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

  // Initialize viewer variable
  let viewer = null;

  // Async initialization
  (async () => {
    try {
      // Initialize Cesium Viewer with configuration
      const viewerOptions = {
        // UI widgets
        timeline: model.get("show_timeline"),
        animation: model.get("show_animation"),
        baseLayerPicker: true,
        geocoder: true,
        homeButton: true,
        sceneModePicker: true,
        navigationHelpButton: true,
        fullscreenButton: true,
        
        // Rendering options
        scene3DOnly: false,
        shadows: false,
        shouldAnimate: false,
      };
      
      // Add terrain if enabled - using Terrain.fromWorldTerrain() as per official docs
      if (model.get("enable_terrain")) {
        viewerOptions.terrain = Cesium.Terrain.fromWorldTerrain();
      }
      
      viewer = new Cesium.Viewer(container, viewerOptions);

      // Remove loading indicator
      if (loadingDiv.parentNode) {
        loadingDiv.remove();
      }

      // Enable lighting if requested
      viewer.scene.globe.enableLighting = model.get("enable_lighting");

      // Function to update camera from model state
      function updateCameraFromModel() {
        if (!viewer) return;
        const lat = model.get("latitude");
        const lon = model.get("longitude");
        const alt = model.get("altitude");
        const heading = Cesium.Math.toRadians(model.get("heading"));
        const pitch = Cesium.Math.toRadians(model.get("pitch"));
        const roll = Cesium.Math.toRadians(model.get("roll"));

        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
          orientation: {
            heading: heading,
            pitch: pitch,
            roll: roll,
          },
        });
      }

      // Function to update model from camera state
      function updateModelFromCamera() {
        if (!viewer) return;
        const position = viewer.camera.positionCartographic;
        const heading = viewer.camera.heading;
        const pitch = viewer.camera.pitch;
        const roll = viewer.camera.roll;

        // Update model (will sync to Python)
        model.set("latitude", Cesium.Math.toDegrees(position.latitude));
        model.set("longitude", Cesium.Math.toDegrees(position.longitude));
        model.set("altitude", position.height);
        model.set("heading", Cesium.Math.toDegrees(heading));
        model.set("pitch", Cesium.Math.toDegrees(pitch));
        model.set("roll", Cesium.Math.toDegrees(roll));
        model.save_changes();
      }

      // Set initial camera position
      updateCameraFromModel();

      // Listen for camera movement and update model
      let cameraUpdateTimeout;
      viewer.camera.changed.addEventListener(() => {
        // Debounce updates to avoid too many syncs
        clearTimeout(cameraUpdateTimeout);
        cameraUpdateTimeout = setTimeout(() => {
          updateModelFromCamera();
        }, 500);
      });

      // Listen for model changes from Python and update camera
      model.on("change:latitude", updateCameraFromModel);
      model.on("change:longitude", updateCameraFromModel);
      model.on("change:altitude", updateCameraFromModel);
      model.on("change:heading", updateCameraFromModel);
      model.on("change:pitch", updateCameraFromModel);
      model.on("change:roll", updateCameraFromModel);

      // Handle terrain changes
      model.on("change:enable_terrain", () => {
        if (!viewer) return;
        if (model.get("enable_terrain")) {
          viewer.scene.setTerrain(Cesium.Terrain.fromWorldTerrain());
        } else {
          viewer.scene.setTerrain(undefined);
        }
      });

      // Handle lighting changes
      model.on("change:enable_lighting", () => {
        if (!viewer) return;
        viewer.scene.globe.enableLighting = model.get("enable_lighting");
      });

      // Handle height changes
      model.on("change:height", () => {
        if (!viewer) return;
        container.style.height = model.get("height");
        viewer.resize();
      });

      // Handle GeoJSON data changes
      let geojsonDataSource = null;
      model.on("change:geojson_data", async () => {
        if (!viewer) return;
        const geojsonData = model.get("geojson_data");
        
        // Remove previous GeoJSON data source if it exists
        if (geojsonDataSource) {
          viewer.dataSources.remove(geojsonDataSource);
          geojsonDataSource = null;
        }

        // Load new GeoJSON data if provided
        if (geojsonData) {
          try {
            geojsonDataSource = await Cesium.GeoJsonDataSource.load(geojsonData, {
              stroke: Cesium.Color.HOTPINK,
              fill: Cesium.Color.PINK.withAlpha(0.5),
              strokeWidth: 3,
            });
            viewer.dataSources.add(geojsonDataSource);
            
            // Fly to the data
            viewer.flyTo(geojsonDataSource);
          } catch (error) {
            console.error("Error loading GeoJSON:", error);
          }
        }
      });

    } catch (error) {
      console.error("Error initializing CesiumJS viewer:", error);
      loadingDiv.textContent = `Error: ${error.message}`;
      loadingDiv.style.background = "rgba(255,0,0,0.8)";
    }
  })();

  // Cleanup function called when widget is destroyed
  return () => {
    if (viewer) {
      viewer.destroy();
    }
  };
}

export default { render };
