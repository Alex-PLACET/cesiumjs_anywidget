/**
 * Camera Synchronization Module
 * 
 * Handles bidirectional synchronization between the Cesium viewer camera
 * and the Python widget model.
 */

/**
 * Initialize camera synchronization between viewer and model
 * @param {Object} viewer - Cesium Viewer instance
 * @param {Object} model - Anywidget traitlet model
 * @returns {Object} Camera sync API
 */
export function initializeCameraSync(viewer, model) {
  const Cesium = window.Cesium;
  let cameraUpdateTimeout;

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
      orientation: { heading, pitch, roll },
    });
  }

  function updateModelFromCamera() {
    if (!viewer) return;
    
    const position = viewer.camera.positionCartographic;
    const heading = viewer.camera.heading;
    const pitch = viewer.camera.pitch;
    const roll = viewer.camera.roll;

    model.set("latitude", Cesium.Math.toDegrees(position.latitude));
    model.set("longitude", Cesium.Math.toDegrees(position.longitude));
    model.set("altitude", position.height);
    model.set("heading", Cesium.Math.toDegrees(heading));
    model.set("pitch", Cesium.Math.toDegrees(pitch));
    model.set("roll", Cesium.Math.toDegrees(roll));
    model.save_changes();
  }

  function handleCameraChanged() {
    clearTimeout(cameraUpdateTimeout);
    cameraUpdateTimeout = setTimeout(() => {
      updateModelFromCamera();
    }, 500);
  }

  // Set initial camera position
  updateCameraFromModel();

  // Listen for camera movement
  viewer.camera.changed.addEventListener(handleCameraChanged);

  // Listen for model changes from Python
  model.on("change:latitude", updateCameraFromModel);
  model.on("change:longitude", updateCameraFromModel);
  model.on("change:altitude", updateCameraFromModel);
  model.on("change:heading", updateCameraFromModel);
  model.on("change:pitch", updateCameraFromModel);
  model.on("change:roll", updateCameraFromModel);

  return {
    updateCameraFromModel,
    updateModelFromCamera,
    destroy: () => {
      clearTimeout(cameraUpdateTimeout);
      viewer.camera.changed.removeEventListener(handleCameraChanged);
    }
  };
}
