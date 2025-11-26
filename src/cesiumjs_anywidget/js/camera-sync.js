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

  // Handle camera commands from Python
  model.on("change:camera_command", () => {
    const command = model.get("camera_command");
    if (!command || !command.command || !command.timestamp) return;

    const cmd = command.command;

    try {
      switch (cmd) {
        case 'flyTo':
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
              command.longitude,
              command.latitude,
              command.altitude
            ),
            orientation: {
              heading: Cesium.Math.toRadians(command.heading || 0),
              pitch: Cesium.Math.toRadians(command.pitch || -15),
              roll: Cesium.Math.toRadians(command.roll || 0)
            },
            duration: command.duration || 3.0
          });
          break;

        case 'setView':
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(
              command.longitude,
              command.latitude,
              command.altitude
            ),
            orientation: {
              heading: Cesium.Math.toRadians(command.heading || 0),
              pitch: Cesium.Math.toRadians(command.pitch || -15),
              roll: Cesium.Math.toRadians(command.roll || 0)
            }
          });
          break;

        case 'lookAt':
          const target = Cesium.Cartesian3.fromDegrees(
            command.targetLongitude,
            command.targetLatitude,
            command.targetAltitude || 0
          );
          const offset = new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians(command.offsetHeading || 0),
            Cesium.Math.toRadians(command.offsetPitch || -45),
            command.offsetRange || 1000
          );
          viewer.camera.lookAt(target, offset);
          // lookAt changes the camera reference frame, so we need to reset it for normal controls
          viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
          break;

        case 'moveForward':
          viewer.camera.moveForward(command.distance || 100);
          break;

        case 'moveBackward':
          viewer.camera.moveBackward(command.distance || 100);
          break;

        case 'moveUp':
          viewer.camera.moveUp(command.distance || 100);
          break;

        case 'moveDown':
          viewer.camera.moveDown(command.distance || 100);
          break;

        case 'moveLeft':
          viewer.camera.moveLeft(command.distance || 100);
          break;

        case 'moveRight':
          viewer.camera.moveRight(command.distance || 100);
          break;

        case 'rotateLeft':
          viewer.camera.rotateLeft(Cesium.Math.toRadians(command.angle || 15));
          break;

        case 'rotateRight':
          viewer.camera.rotateRight(Cesium.Math.toRadians(command.angle || 15));
          break;

        case 'rotateUp':
          viewer.camera.rotateUp(Cesium.Math.toRadians(command.angle || 15));
          break;

        case 'rotateDown':
          viewer.camera.rotateDown(Cesium.Math.toRadians(command.angle || 15));
          break;

        case 'zoomIn':
          viewer.camera.zoomIn(command.distance || 100);
          break;

        case 'zoomOut':
          viewer.camera.zoomOut(command.distance || 100);
          break;

        default:
          console.warn(`Unknown camera command: ${cmd}`);
      }
    } catch (error) {
      console.error(`Error executing camera command ${cmd}:`, error);
    }
  });

  return {
    updateCameraFromModel,
    updateModelFromCamera,
    destroy: () => {
      clearTimeout(cameraUpdateTimeout);
      viewer.camera.changed.removeEventListener(handleCameraChanged);
    }
  };
}
