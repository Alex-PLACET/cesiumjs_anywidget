/**
 * Measurement Tools Module
 * 
 * Handles all measurement functionality including distance, multi-distance,
 * height, and area measurements.
 */

/**
 * Initialize measurement tools for a Cesium viewer
 * @param {Object} viewer - Cesium Viewer instance
 * @param {Object} model - Anywidget traitlet model
 * @param {HTMLElement} container - Container element for toolbar
 * @returns {Object} Measurement tools API
 */
export function initializeMeasurementTools(viewer, model, container) {
  console.log('[CesiumWidget:MeasurementTools] Initializing measurement tools');
  const Cesium = window.Cesium;

  let measurementHandler = null;
  let editHandler = null;
  let isDestroyed = false;
  let measurementState = {
    mode: null,
    points: [],
    entities: [],
    labels: [],
    polylines: [],
    polyline: null,
    tempPolyline: null,
  };

  // Edit state for point manipulation
  let editState = {
    enabled: false,
    selectedPoint: null,
    selectedEntity: null,
    dragging: false,
    measurementIndex: null,
    pointIndex: null,
  };

  // Store all completed measurements with their visual elements
  let completedMeasurements = [];

  // ============= UI CREATION =============

  const toolbarDiv = document.createElement("div");
  toolbarDiv.style.cssText = `
    position: absolute;
    top: 10px;
    left: 10px;
    background: rgba(42, 42, 42, 0.9);
    padding: 10px;
    border-radius: 5px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 5px;
  `;
  container.appendChild(toolbarDiv);

  function createMeasurementButton(text, mode) {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.style.cssText = `
      padding: 8px 12px;
      background: #3498db;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s;
    `;
    btn.onmouseover = () => { btn.style.background = '#2980b9'; };
    btn.onmouseout = () => {
      btn.style.background = measurementState.mode === mode ? '#e74c3c' : '#3498db';
    };
    btn.onclick = () => {
      if (measurementState.mode === mode) {
        model.set("measurement_mode", "");
        model.save_changes();
      } else {
        model.set("measurement_mode", mode);
        model.save_changes();
      }
    };
    return btn;
  }

  const distanceBtn = createMeasurementButton("📏 Distance", "distance");
  const multiDistanceBtn = createMeasurementButton("📐 Multi Distance", "multi-distance");
  const heightBtn = createMeasurementButton("📊 Height", "height");
  const areaBtn = createMeasurementButton("⬛ Area", "area");

  const clearBtn = document.createElement("button");
  clearBtn.textContent = "🗑️ Clear";
  clearBtn.style.cssText = `
    padding: 8px 12px;
    background: #e74c3c;
    color: white;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    transition: background 0.2s;
  `;
  clearBtn.onmouseover = () => { clearBtn.style.background = '#c0392b'; };
  clearBtn.onmouseout = () => { clearBtn.style.background = '#e74c3c'; };
  clearBtn.onclick = () => {
    clearAllMeasurements();
    model.set("measurement_mode", "");
    model.set("measurement_results", []);
    model.save_changes();
  };

  toolbarDiv.appendChild(distanceBtn);
  toolbarDiv.appendChild(multiDistanceBtn);
  toolbarDiv.appendChild(heightBtn);
  toolbarDiv.appendChild(areaBtn);
  toolbarDiv.appendChild(clearBtn);

  // Edit mode button
  const editBtn = document.createElement("button");
  editBtn.textContent = "✏️ Edit Points";
  editBtn.style.cssText = `
    padding: 8px 12px;
    background: #9b59b6;
    color: white;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    transition: background 0.2s;
  `;
  editBtn.onmouseover = () => { editBtn.style.background = '#8e44ad'; };
  editBtn.onmouseout = () => { editBtn.style.background = editState.enabled ? '#e74c3c' : '#9b59b6'; };
  editBtn.onclick = () => {
    editState.enabled = !editState.enabled;
    editBtn.style.background = editState.enabled ? '#e74c3c' : '#9b59b6';
    if (editState.enabled) {
      enableEditMode();
    } else {
      disableEditMode();
    }
  };
  toolbarDiv.appendChild(editBtn);

  // Coordinate editor panel
  const editorPanel = document.createElement("div");
  editorPanel.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(42, 42, 42, 0.95);
    padding: 15px;
    border-radius: 5px;
    z-index: 1000;
    display: none;
    color: white;
    font-family: sans-serif;
    font-size: 12px;
    min-width: 250px;
  `;
  container.appendChild(editorPanel);

  // Measurements list panel
  const measurementsListPanel = document.createElement("div");
  measurementsListPanel.style.cssText = `
    position: absolute;
    bottom: 10px;
    right: 10px;
    background: rgba(42, 42, 42, 0.95);
    padding: 15px;
    border-radius: 5px;
    z-index: 1000;
    color: white;
    font-family: sans-serif;
    font-size: 12px;
    max-width: 350px;
    max-height: 400px;
    overflow-y: auto;
  `;
  measurementsListPanel.innerHTML = `
    <div style="font-weight: bold; border-bottom: 1px solid #555; padding-bottom: 8px; margin-bottom: 10px;">
      Measurements
    </div>
    <div id="measurements-list-content"></div>
  `;
  container.appendChild(measurementsListPanel);

  // ============= HELPER FUNCTIONS =============

  function getPosition(screenPosition) {
    const pickedObject = viewer.scene.pick(screenPosition);
    if (viewer.scene.pickPositionSupported && Cesium.defined(pickedObject)) {
      const cartesian = viewer.scene.pickPosition(screenPosition);
      if (Cesium.defined(cartesian)) {
        return cartesian;
      }
    }
    const ray = viewer.camera.getPickRay(screenPosition);
    return viewer.scene.globe.pick(ray, viewer.scene);
  }

  function addMarker(position, color = Cesium.Color.RED) {
    const marker = viewer.entities.add({
      position: position,
      point: {
        pixelSize: 10,
        color: color,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    measurementState.entities.push(marker);
    return marker;
  }

  function addLabel(position, text) {
    const label = viewer.entities.add({
      position: position,
      label: {
        text: text,
        font: "14px sans-serif",
        fillColor: Cesium.Color.WHITE,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        outlineColor: Cesium.Color.BLACK,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        showBackground: true,
        backgroundColor: Cesium.Color.fromAlpha(Cesium.Color.BLACK, 0.7),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    measurementState.labels.push(label);
    return label;
  }

  function calculateDistance(point1, point2) {
    return Cesium.Cartesian3.distance(point1, point2);
  }

  function getMidpoint(point1, point2) {
    return Cesium.Cartesian3.lerp(point1, point2, 0.5, new Cesium.Cartesian3());
  }

  function cartesianToLatLonAlt(cartesian) {
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    return {
      lat: Cesium.Math.toDegrees(cartographic.latitude),
      lon: Cesium.Math.toDegrees(cartographic.longitude),
      alt: cartographic.height,
    };
  }

  function clearAllMeasurements() {
    console.log('[CesiumWidget:MeasurementTools] Clearing all measurements');
    measurementState.entities.forEach(e => viewer.entities.remove(e));
    measurementState.labels.forEach(l => viewer.entities.remove(l));
    measurementState.polylines.forEach(p => viewer.entities.remove(p));
    if (measurementState.polyline) {
      viewer.entities.remove(measurementState.polyline);
    }
    if (measurementState.tempPolyline) {
      viewer.entities.remove(measurementState.tempPolyline);
    }
    measurementState.points = [];
    measurementState.entities = [];
    measurementState.labels = [];
    measurementState.polylines = [];
    measurementState.polyline = null;
    measurementState.tempPolyline = null;
  }

  function clearInProgressMeasurement() {
    if (measurementState.tempPolyline) {
      viewer.entities.remove(measurementState.tempPolyline);
      measurementState.tempPolyline = null;
    }
    if ((measurementState.mode === "multi-distance" || measurementState.mode === "area") && measurementState.polyline) {
      viewer.entities.remove(measurementState.polyline);
      measurementState.polyline = null;
      measurementState.polylines = measurementState.polylines.filter(p => p !== measurementState.polyline);
    }
    measurementState.points = [];
    measurementState.tempPoint = null;
  }

  // ============= EDIT MODE FUNCTIONS =============

  function enableEditMode() {
    // Disable measurement mode
    if (measurementState.mode) {
      model.set("measurement_mode", "");
      model.save_changes();
    }

    // Highlight all measurement points to make them selectable
    measurementState.entities.forEach(entity => {
      if (entity.point) {
        entity.point.pixelSize = 12;
        entity.point.outlineWidth = 3;
      }
    });

    // Set up edit handlers
    editHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    editHandler.setInputAction((click) => {
      const pickedObject = viewer.scene.pick(click.position);
      if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.point) {
        selectPoint(pickedObject.id, click.position);
      } else {
        deselectPoint();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    editHandler.setInputAction((movement) => {
      if (editState.dragging && editState.selectedEntity) {
        const position = getPosition(movement.endPosition);
        if (position) {
          updatePointPosition(position);
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    editHandler.setInputAction(() => {
      if (editState.selectedEntity) {
        editState.dragging = true;
        viewer.scene.screenSpaceCameraController.enableRotate = false;
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    editHandler.setInputAction(() => {
      if (editState.dragging) {
        editState.dragging = false;
        viewer.scene.screenSpaceCameraController.enableRotate = true;
        finalizeMeasurementUpdate();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_UP);
  }

  function disableEditMode() {
    if (editHandler) {
      editHandler.destroy();
      editHandler = null;
    }

    deselectPoint();

    // Reset point sizes
    measurementState.entities.forEach(entity => {
      if (entity.point) {
        entity.point.pixelSize = 10;
        entity.point.outlineWidth = 2;
      }
    });

    viewer.scene.screenSpaceCameraController.enableRotate = true;
  }

  function selectPoint(entity, screenPosition) {
    // Find which measurement and point this entity belongs to
    const results = model.get("measurement_results") || [];
    let measurementIndex = -1;
    let pointIndex = -1;

    for (let i = 0; i < measurementState.entities.length; i++) {
      if (measurementState.entities[i] === entity) {
        // Determine which measurement this belongs to by counting entities
        let entityCount = 0;
        for (let m = 0; m < results.length; m++) {
          const measurement = results[m];
          const numPoints = measurement.points.length;
          if (i < entityCount + numPoints) {
            measurementIndex = m;
            pointIndex = i - entityCount;
            break;
          }
          entityCount += numPoints;
        }
        break;
      }
    }

    if (measurementIndex === -1) return;

    editState.selectedEntity = entity;
    editState.measurementIndex = measurementIndex;
    editState.pointIndex = pointIndex;
    editState.selectedPoint = entity.position.getValue(Cesium.JulianDate.now());

    // Highlight selected point
    entity.point.pixelSize = 15;
    entity.point.outlineWidth = 4;
    entity.point.outlineColor = Cesium.Color.YELLOW;

    // Show coordinate editor
    showCoordinateEditor(results[measurementIndex], pointIndex);
  }

  function deselectPoint() {
    if (editState.selectedEntity && editState.selectedEntity.point) {
      editState.selectedEntity.point.pixelSize = 12;
      editState.selectedEntity.point.outlineWidth = 3;
      editState.selectedEntity.point.outlineColor = Cesium.Color.WHITE;
    }

    editState.selectedEntity = null;
    editState.selectedPoint = null;
    editState.measurementIndex = null;
    editState.pointIndex = null;
    editState.dragging = false;

    editorPanel.style.display = 'none';
  }

  function showCoordinateEditor(measurement, pointIndex) {
    const point = measurement.points[pointIndex];

    editorPanel.innerHTML = `
      <div style="margin-bottom: 10px; font-weight: bold; border-bottom: 1px solid #555; padding-bottom: 5px;">
        Edit Point ${pointIndex + 1} (${measurement.type})
      </div>
      <div style="margin-bottom: 8px;">
        <label style="display: block; margin-bottom: 3px;">Longitude (°):</label>
        <input type="number" id="edit-lon" value="${point.lon.toFixed(6)}" step="0.000001" 
               style="width: 100%; padding: 5px; border-radius: 3px; border: 1px solid #555; background: #2c2c2c; color: white;">
      </div>
      <div style="margin-bottom: 8px;">
        <label style="display: block; margin-bottom: 3px;">Latitude (°):</label>
        <input type="number" id="edit-lat" value="${point.lat.toFixed(6)}" step="0.000001"
               style="width: 100%; padding: 5px; border-radius: 3px; border: 1px solid #555; background: #2c2c2c; color: white;">
      </div>
      <div style="margin-bottom: 10px;">
        <label style="display: block; margin-bottom: 3px;">Altitude (m):</label>
        <input type="number" id="edit-alt" value="${point.alt.toFixed(2)}" step="1"
               style="width: 100%; padding: 5px; border-radius: 3px; border: 1px solid #555; background: #2c2c2c; color: white;">
      </div>
      <button id="apply-coords" style="width: 100%; padding: 8px; background: #27ae60; color: white; border: none; border-radius: 3px; cursor: pointer; margin-bottom: 5px;">
        Apply
      </button>
      <button id="close-editor" style="width: 100%; padding: 8px; background: #95a5a6; color: white; border: none; border-radius: 3px; cursor: pointer;">
        Close
      </button>
    `;

    editorPanel.style.display = 'block';

    // Add event listeners
    const applyBtn = document.getElementById('apply-coords');
    const closeBtn = document.getElementById('close-editor');
    const editLonInput = document.getElementById('edit-lon');
    const editLatInput = document.getElementById('edit-lat');
    const editAltInput = document.getElementById('edit-alt');

    if (!applyBtn || !closeBtn || !editLonInput || !editLatInput || !editAltInput) {
      console.warn("[CesiumWidget] Editor panel input elements not found in DOM");
    }

    if (applyBtn) {
      applyBtn.onclick = () => {
        if (!editLonInput || !editLatInput || !editAltInput) {
          console.warn("[CesiumWidget] Editor input fields not available");
          return;
        }
        const lon = parseFloat(editLonInput.value);
        const lat = parseFloat(editLatInput.value);
        const alt = parseFloat(editAltInput.value);

        const newPosition = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
        updatePointPosition(newPosition);
        finalizeMeasurementUpdate();
      };
    }

    if (closeBtn) {
      closeBtn.onclick = () => {
        deselectPoint();
      };
    }

    // Update on Enter key
    ['edit-lon', 'edit-lat', 'edit-alt'].forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.onkeypress = (e) => {
          if (e.key === 'Enter' && applyBtn) {
            applyBtn.click();
          }
        };
      }
    });
  }

  function updatePointPosition(newPosition) {
    if (!editState.selectedEntity) return;

    editState.selectedEntity.position = newPosition;
    editState.selectedPoint = newPosition;

    // Update visual elements (lines, polygons, labels)
    updateMeasurementVisuals();
  }

  function updateMeasurementVisuals() {
    const results = model.get("measurement_results") || [];
    if (editState.measurementIndex === null) return;

    const measurement = results[editState.measurementIndex];

    // Collect all entity positions for this measurement
    let entityStartIndex = 0;
    for (let i = 0; i < editState.measurementIndex; i++) {
      entityStartIndex += results[i].points.length;
    }

    const positions = [];
    for (let i = 0; i < measurement.points.length; i++) {
      const entity = measurementState.entities[entityStartIndex + i];
      if (entity && entity.position) {
        positions.push(entity.position.getValue(Cesium.JulianDate.now()));
      }
    }

    // Find and update polylines/polygons for this measurement
    const polylineStartIndex = editState.measurementIndex;
    if (measurementState.polylines[polylineStartIndex]) {
      const oldEntity = measurementState.polylines[polylineStartIndex];

      if (measurement.type === "area" && oldEntity.polygon) {
        // Remove old polygon and create new one with updated positions
        viewer.entities.remove(oldEntity);

        const newPolygon = viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(positions),
            material: Cesium.Color.ORANGE.withAlpha(0.3),
            outline: true,
            outlineColor: Cesium.Color.ORANGE,
            outlineWidth: 2,
          },
        });
        measurementState.polylines[polylineStartIndex] = newPolygon;

      } else if (oldEntity.polyline) {
        if (measurement.type === "height") {
          // Height measurements have special L-shaped lines
          const carto0 = Cesium.Cartographic.fromCartesian(positions[0]);
          const carto1 = Cesium.Cartographic.fromCartesian(positions[1]);
          oldEntity.polyline.positions = [
            positions[0],
            Cesium.Cartesian3.fromRadians(carto1.longitude, carto1.latitude, carto0.height),
            positions[1],
          ];
        } else {
          oldEntity.polyline.positions = positions;
        }
      }
    }

    // Update labels with recalculated measurements
    updateMeasurementLabels(measurement.type, positions);
  }

  function updateMeasurementLabels(type, positions) {
    // Remove old labels for this measurement and recreate them
    // This is simplified - you might want to track label indices more carefully
    const labelStartIndex = editState.measurementIndex;

    if (type === "distance") {
      const distance = Cesium.Cartesian3.distance(positions[0], positions[1]);
      const midpoint = Cesium.Cartesian3.midpoint(positions[0], positions[1], new Cesium.Cartesian3());
      const distanceText = distance >= 1000 ? `${(distance / 1000).toFixed(2)} km` : `${distance.toFixed(2)} m`;

      // Update existing label
      if (measurementState.labels[labelStartIndex]) {
        measurementState.labels[labelStartIndex].position = midpoint;
        measurementState.labels[labelStartIndex].label.text = distanceText;
      }
    } else if (type === "height") {
      const carto0 = Cesium.Cartographic.fromCartesian(positions[0]);
      const carto1 = Cesium.Cartographic.fromCartesian(positions[1]);
      const verticalDistance = Math.abs(carto1.height - carto0.height);
      const midHeight = (carto0.height + carto1.height) / 2;
      const labelPos = Cesium.Cartesian3.fromRadians(carto1.longitude, carto1.latitude, midHeight);
      const heightText = verticalDistance >= 1000 ? `${(verticalDistance / 1000).toFixed(2)} km` : `${verticalDistance.toFixed(2)} m`;

      if (measurementState.labels[labelStartIndex]) {
        measurementState.labels[labelStartIndex].position = labelPos;
        measurementState.labels[labelStartIndex].label.text = heightText;
      }
    }
    // Note: multi-distance and area would need more complex label updates
  }

  function finalizeMeasurementUpdate() {
    if (editState.measurementIndex === null || editState.pointIndex === null) return;

    const results = model.get("measurement_results") || [];
    const measurement = results[editState.measurementIndex];

    // Update the point coordinates
    const cartographic = Cesium.Cartographic.fromCartesian(editState.selectedPoint);
    measurement.points[editState.pointIndex] = {
      lat: Cesium.Math.toDegrees(cartographic.latitude),
      lon: Cesium.Math.toDegrees(cartographic.longitude),
      alt: cartographic.height,
    };

    // Recalculate measurement value
    let entityStartIndex = 0;
    for (let i = 0; i < editState.measurementIndex; i++) {
      entityStartIndex += results[i].points.length;
    }

    const positions = [];
    for (let i = 0; i < measurement.points.length; i++) {
      const entity = measurementState.entities[entityStartIndex + i];
      if (entity && entity.position) {
        positions.push(entity.position.getValue(Cesium.JulianDate.now()));
      }
    }

    if (measurement.type === "distance") {
      measurement.value = Cesium.Cartesian3.distance(positions[0], positions[1]);
    } else if (measurement.type === "height") {
      const carto0 = Cesium.Cartographic.fromCartesian(positions[0]);
      const carto1 = Cesium.Cartographic.fromCartesian(positions[1]);
      measurement.value = Math.abs(carto1.height - carto0.height);
    } else if (measurement.type === "multi-distance") {
      let totalDistance = 0;
      for (let i = 0; i < positions.length - 1; i++) {
        totalDistance += Cesium.Cartesian3.distance(positions[i], positions[i + 1]);
      }
      measurement.value = totalDistance;
    } else if (measurement.type === "area") {
      // Use Cesium's PolygonGeometry to calculate geodesic area
      const polygonHierarchy = new Cesium.PolygonHierarchy(positions);
      const geometry = Cesium.PolygonGeometry.createGeometry(
        new Cesium.PolygonGeometry({
          polygonHierarchy: polygonHierarchy,
          perPositionHeight: false,
          arcType: Cesium.ArcType.GEODESIC
        })
      );

      let area = 0;
      if (geometry) {
        const positionsArray = geometry.attributes.position.values;
        const indices = geometry.indices;

        for (let i = 0; i < indices.length; i += 3) {
          const i0 = indices[i] * 3;
          const i1 = indices[i + 1] * 3;
          const i2 = indices[i + 2] * 3;

          const v0 = new Cesium.Cartesian3(positionsArray[i0], positionsArray[i0 + 1], positionsArray[i0 + 2]);
          const v1 = new Cesium.Cartesian3(positionsArray[i1], positionsArray[i1 + 1], positionsArray[i1 + 2]);
          const v2 = new Cesium.Cartesian3(positionsArray[i2], positionsArray[i2 + 1], positionsArray[i2 + 2]);

          const edge1 = Cesium.Cartesian3.subtract(v1, v0, new Cesium.Cartesian3());
          const edge2 = Cesium.Cartesian3.subtract(v2, v0, new Cesium.Cartesian3());
          const crossProduct = Cesium.Cartesian3.cross(edge1, edge2, new Cesium.Cartesian3());
          const triangleArea = Cesium.Cartesian3.magnitude(crossProduct) / 2.0;

          area += triangleArea;
        }
      }
      measurement.value = area;
    }

    // Sync back to Python
    const newResults = [...results];
    model.set("measurement_results", newResults);
    model.save_changes();

    // Update the measurements list
    updateMeasurementsList();

    // Update the coordinate editor if still open
    if (editorPanel.style.display !== 'none') {
      showCoordinateEditor(measurement, editState.pointIndex);
    }
  }

  // ============= MEASUREMENTS LIST FUNCTIONS =============

  function updateMeasurementsList() {
    const results = model.get("measurement_results") || [];
    console.log('[CesiumWidget:MeasurementTools] Updating measurements list, count:', results.length);
    const listContent = document.getElementById("measurements-list-content");

    if (!listContent) {
      console.warn("[CesiumWidget] Measurements list content element not found in DOM");
      return;
    }

    if (results.length === 0) {
      listContent.innerHTML = '<div style="color: #888; font-style: italic;">No measurements yet</div>';
      return;
    }

    listContent.innerHTML = '';

    results.forEach((measurement, index) => {
      const measurementDiv = document.createElement("div");
      measurementDiv.style.cssText = `
        background: rgba(255, 255, 255, 0.05);
        padding: 10px;
        margin-bottom: 8px;
        border-radius: 3px;
        cursor: pointer;
        transition: background 0.2s;
        border-left: 3px solid ${getMeasurementColor(measurement.type)};
      `;
      measurementDiv.onmouseover = () => {
        measurementDiv.style.background = 'rgba(255, 255, 255, 0.15)';
      };
      measurementDiv.onmouseout = () => {
        measurementDiv.style.background = 'rgba(255, 255, 255, 0.05)';
      };

      // Measurement name (editable)
      const name = measurement.name || `${getMeasurementTypeLabel(measurement.type)} ${index + 1}`;
      const nameDiv = document.createElement("div");
      nameDiv.style.cssText = `
        font-weight: bold;
        margin-bottom: 5px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;
      nameDiv.innerHTML = `
        <span style="flex: 1;">${name}</span>
        <button id="rename-${index}" style="padding: 2px 6px; background: #3498db; color: white; border: none; border-radius: 2px; cursor: pointer; font-size: 10px;">✎</button>
      `;
      measurementDiv.appendChild(nameDiv);

      // Measurement value
      const valueDiv = document.createElement("div");
      valueDiv.style.cssText = 'color: #aaa; font-size: 11px; margin-bottom: 3px;';
      valueDiv.textContent = formatMeasurementValue(measurement);
      measurementDiv.appendChild(valueDiv);

      // Number of points
      const pointsDiv = document.createElement("div");
      pointsDiv.style.cssText = 'color: #888; font-size: 10px;';
      pointsDiv.textContent = `${measurement.points.length} point${measurement.points.length > 1 ? 's' : ''}`;
      measurementDiv.appendChild(pointsDiv);

      // Click to focus
      measurementDiv.onclick = (e) => {
        if (!e.target.id.startsWith('rename-')) {
          focusOnMeasurement(index);
        }
      };

      listContent.appendChild(measurementDiv);

      // Add rename functionality
      const renameBtn = document.getElementById(`rename-${index}`);
      if (renameBtn) {
        renameBtn.onclick = (e) => {
          e.stopPropagation();
          renameMeasurement(index, name);
        };
      } else {
        console.warn(`[CesiumWidget] Rename button not found for measurement ${index}`);
      }
    });
  }

  function getMeasurementColor(type) {
    const colors = {
      'distance': '#e74c3c',
      'multi-distance': '#3498db',
      'height': '#2ecc71',
      'area': '#e67e22'
    };
    return colors[type] || '#95a5a6';
  }

  function getMeasurementTypeLabel(type) {
    const labels = {
      'distance': 'Distance',
      'multi-distance': 'Multi-Distance',
      'height': 'Height',
      'area': 'Area'
    };
    return labels[type] || type;
  }

  function formatMeasurementValue(measurement) {
    const value = measurement.value;
    const type = measurement.type;

    if (type === 'area') {
      return value >= 1000000 ? `${(value / 1000000).toFixed(2)} km²` : `${value.toFixed(2)} m²`;
    } else {
      return value >= 1000 ? `${(value / 1000).toFixed(2)} km` : `${value.toFixed(2)} m`;
    }
  }

  function renameMeasurement(index, currentName) {
    const newName = prompt('Enter new name for measurement:', currentName);
    if (newName && newName.trim()) {
      const results = model.get("measurement_results") || [];
      const newResults = [...results];
      newResults[index] = { ...newResults[index], name: newName.trim() };
      model.set("measurement_results", newResults);
      model.save_changes();
      updateMeasurementsList();
    }
  }

  function focusOnMeasurement(index) {
    const results = model.get("measurement_results") || [];
    if (index < 0 || index >= results.length) return;

    const measurement = results[index];
    if (!measurement.points || measurement.points.length === 0) return;

    // Calculate bounding sphere for all points
    const positions = measurement.points.map(p =>
      Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt || 0)
    );

    const boundingSphere = Cesium.BoundingSphere.fromPoints(positions);

    // Fly to the measurement with padding
    viewer.camera.flyToBoundingSphere(boundingSphere, {
      duration: 1.5,
      offset: new Cesium.HeadingPitchRange(
        0,
        Cesium.Math.toRadians(-45),
        boundingSphere.radius * 3
      )
    });
  }

  // ============= MEASUREMENT HANDLERS =============

  function handleDistanceClick(click) {
    const position = getPosition(click.position);
    if (!position) return;

    if (measurementState.points.length === 0) {
      measurementState.points.push(position);
      addMarker(position);

      measurementState.tempPolyline = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            if (measurementState.points.length === 1 && measurementState.tempPoint) {
              return [measurementState.points[0], measurementState.tempPoint];
            }
            return measurementState.points;
          }, false),
          width: 3,
          material: Cesium.Color.YELLOW,
          depthFailMaterial: Cesium.Color.YELLOW,
        },
      });
    } else if (measurementState.points.length === 1) {
      measurementState.points.push(position);
      addMarker(position);

      const distance = calculateDistance(measurementState.points[0], measurementState.points[1]);
      const midpoint = getMidpoint(measurementState.points[0], measurementState.points[1]);
      addLabel(midpoint, `${distance.toFixed(2)} m`);

      if (measurementState.tempPolyline) {
        viewer.entities.remove(measurementState.tempPolyline);
        measurementState.tempPolyline = null;
      }
      measurementState.polyline = viewer.entities.add({
        polyline: {
          positions: measurementState.points,
          width: 3,
          material: Cesium.Color.RED,
          depthFailMaterial: Cesium.Color.RED,
        },
      });
      measurementState.polylines.push(measurementState.polyline);

      const results = model.get("measurement_results") || [];
      const newResults = [...results, {
        type: "distance",
        value: distance,
        points: measurementState.points.map(cartesianToLatLonAlt),
        name: `Distance ${results.filter(r => r.type === 'distance').length + 1}`,
      }];
      model.set("measurement_results", newResults);
      model.save_changes();

      measurementState.points = [];
    }
  }

  function handleMultiDistanceClick(click) {
    const position = getPosition(click.position);
    if (!position) return;

    measurementState.points.push(position);
    addMarker(position, Cesium.Color.BLUE);

    if (measurementState.points.length === 1) {
      measurementState.polyline = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => measurementState.points, false),
          width: 3,
          material: Cesium.Color.BLUE,
          depthFailMaterial: Cesium.Color.BLUE,
        },
      });
      measurementState.polylines.push(measurementState.polyline);
    } else {
      const p1 = measurementState.points[measurementState.points.length - 2];
      const p2 = measurementState.points[measurementState.points.length - 1];
      const distance = calculateDistance(p1, p2);
      const midpoint = getMidpoint(p1, p2);
      addLabel(midpoint, `${distance.toFixed(2)} m`);

      let totalDistance = 0;
      for (let i = 0; i < measurementState.points.length - 1; i++) {
        totalDistance += calculateDistance(
          measurementState.points[i],
          measurementState.points[i + 1]
        );
      }

      const results = model.get("measurement_results") || [];
      const lastResult = results[results.length - 1];
      let newResults;
      if (lastResult && lastResult.type === "multi-distance" && lastResult.isActive) {
        newResults = [...results];
        newResults[newResults.length - 1] = {
          ...lastResult,
          value: totalDistance,
          points: measurementState.points.map(cartesianToLatLonAlt),
        };
      } else {
        const multiDistanceCount = results.filter(r => r.type === 'multi-distance').length + 1;
        newResults = [...results, {
          type: "multi-distance",
          value: totalDistance,
          points: measurementState.points.map(cartesianToLatLonAlt),
          isActive: true,
          name: `Multi-Distance ${multiDistanceCount}`,
        }];
      }
      model.set("measurement_results", newResults);
      model.save_changes();
    }
  }

  function handleHeightClick(click) {
    const pickedPosition = getPosition(click.position);
    if (!pickedPosition) return;

    const cartographic = Cesium.Cartographic.fromCartesian(pickedPosition);
    const terrainHeight = viewer.scene.globe.getHeight(cartographic) || 0;
    const pickedHeight = cartographic.height;
    const height = pickedHeight - terrainHeight;

    const groundPosition = Cesium.Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      terrainHeight
    );

    addMarker(groundPosition, Cesium.Color.GREEN);
    addMarker(pickedPosition, Cesium.Color.GREEN);

    const heightLine = viewer.entities.add({
      polyline: {
        positions: [groundPosition, pickedPosition],
        width: 3,
        material: Cesium.Color.GREEN,
        depthFailMaterial: Cesium.Color.GREEN,
      },
    });
    measurementState.polylines.push(heightLine);

    const midpoint = getMidpoint(groundPosition, pickedPosition);
    addLabel(midpoint, `${height.toFixed(2)} m`);

    const results = model.get("measurement_results") || [];
    const newResults = [...results, {
      type: "height",
      value: height,
      points: [cartesianToLatLonAlt(groundPosition), cartesianToLatLonAlt(pickedPosition)],
      name: `Height ${results.filter(r => r.type === 'height').length + 1}`,
    }];
    model.set("measurement_results", newResults);
    model.save_changes();
  }

  function handleAreaClick(click) {
    const position = getPosition(click.position);
    if (!position) return;

    measurementState.points.push(position);
    addMarker(position, Cesium.Color.ORANGE);

    if (measurementState.points.length === 1) {
      measurementState.polyline = viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.CallbackProperty(() => {
            return new Cesium.PolygonHierarchy(measurementState.points);
          }, false),
          material: Cesium.Color.ORANGE.withAlpha(0.3),
          outline: true,
          outlineColor: Cesium.Color.ORANGE,
          outlineWidth: 2,
        },
      });
      measurementState.polylines.push(measurementState.polyline);
    }

    if (measurementState.points.length >= 3) {
      const positions = measurementState.points;

      // Use Cesium's PolygonGeometry to calculate geodesic area on the ellipsoid
      const polygonHierarchy = new Cesium.PolygonHierarchy(positions);
      const geometry = Cesium.PolygonGeometry.createGeometry(
        new Cesium.PolygonGeometry({
          polygonHierarchy: polygonHierarchy,
          perPositionHeight: false,
          arcType: Cesium.ArcType.GEODESIC
        })
      );

      // Calculate area using triangulated geometry
      let area = 0;
      if (geometry) {
        const positionsArray = geometry.attributes.position.values;
        const indices = geometry.indices;

        // Sum up the area of all triangles
        for (let i = 0; i < indices.length; i += 3) {
          const i0 = indices[i] * 3;
          const i1 = indices[i + 1] * 3;
          const i2 = indices[i + 2] * 3;

          const v0 = new Cesium.Cartesian3(positionsArray[i0], positionsArray[i0 + 1], positionsArray[i0 + 2]);
          const v1 = new Cesium.Cartesian3(positionsArray[i1], positionsArray[i1 + 1], positionsArray[i1 + 2]);
          const v2 = new Cesium.Cartesian3(positionsArray[i2], positionsArray[i2 + 1], positionsArray[i2 + 2]);

          // Calculate triangle area using cross product
          const edge1 = Cesium.Cartesian3.subtract(v1, v0, new Cesium.Cartesian3());
          const edge2 = Cesium.Cartesian3.subtract(v2, v0, new Cesium.Cartesian3());
          const crossProduct = Cesium.Cartesian3.cross(edge1, edge2, new Cesium.Cartesian3());
          const triangleArea = Cesium.Cartesian3.magnitude(crossProduct) / 2.0;

          area += triangleArea;
        }
      }

      // Calculate centroid in geographic coordinates for better accuracy
      let centroidLon = 0, centroidLat = 0;
      positions.forEach(pos => {
        const carto = Cesium.Cartographic.fromCartesian(pos);
        centroidLon += carto.longitude;
        centroidLat += carto.latitude;
      });
      centroidLon /= positions.length;
      centroidLat /= positions.length;

      const areaText = area >= 1000000
        ? `${(area / 1000000).toFixed(2)} km²`
        : `${area.toFixed(2)} m²`;

      const oldLabel = measurementState.labels.find(l => l.label && l.label.text._value.includes('m²') || l.label.text._value.includes('km²'));
      if (oldLabel) {
        viewer.entities.remove(oldLabel);
        measurementState.labels = measurementState.labels.filter(l => l !== oldLabel);
      }

      // Sample terrain height at centroid and place label at ground level
      const centroidCarto = new Cesium.Cartographic(centroidLon, centroidLat);
      const promise = Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [centroidCarto]);
      promise.then(() => {
        const centroid = Cesium.Cartographic.toCartesian(centroidCarto);
        addLabel(centroid, areaText);
      });

      const results = model.get("measurement_results") || [];
      const lastResult = results[results.length - 1];
      let newResults;
      if (lastResult && lastResult.type === "area" && lastResult.isActive) {
        newResults = [...results];
        newResults[newResults.length - 1] = {
          ...lastResult,
          value: area,
          points: measurementState.points.map(cartesianToLatLonAlt),
        };
      } else {
        const areaCount = results.filter(r => r.type === 'area').length + 1;
        newResults = [...results, {
          type: "area",
          value: area,
          points: measurementState.points.map(cartesianToLatLonAlt),
          isActive: true,
          name: `Area ${areaCount}`,
        }];
      }
      model.set("measurement_results", newResults);
      model.save_changes();
    }
  }

  function handleMouseMove(movement) {
    if (measurementState.mode === "distance" && measurementState.points.length === 1) {
      const position = getPosition(movement.endPosition);
      if (position) {
        measurementState.tempPoint = position;
      }
    }
  }

  // ============= MODE MANAGEMENT =============

  function enableMeasurementMode(mode) {
    console.log('[CesiumWidget:MeasurementTools] Enabling measurement mode:', mode);
    if (measurementHandler) {
      measurementHandler.destroy();
      measurementHandler = null;
    }

    clearInProgressMeasurement();
    measurementState.mode = mode;

    distanceBtn.style.background = mode === "distance" ? "#e74c3c" : "#3498db";
    multiDistanceBtn.style.background = mode === "multi-distance" ? "#e74c3c" : "#3498db";
    heightBtn.style.background = mode === "height" ? "#e74c3c" : "#3498db";
    areaBtn.style.background = mode === "area" ? "#e74c3c" : "#3498db";

    if (!mode) return;

    measurementHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    if (mode === "distance") {
      measurementHandler.setInputAction(handleDistanceClick, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      measurementHandler.setInputAction(handleMouseMove, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    } else if (mode === "multi-distance") {
      measurementHandler.setInputAction(handleMultiDistanceClick, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      measurementHandler.setInputAction(() => {
        if (measurementState.points.length > 0) {
          const results = model.get("measurement_results") || [];
          const lastResult = results[results.length - 1];
          if (lastResult && lastResult.isActive) {
            const newResults = [...results];
            const { isActive, ...finalResult } = lastResult;
            newResults[newResults.length - 1] = finalResult;
            model.set("measurement_results", newResults);
            model.save_changes();
          }
          measurementState.points = [];
        }
      }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    } else if (mode === "height") {
      measurementHandler.setInputAction(handleHeightClick, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    } else if (mode === "area") {
      measurementHandler.setInputAction(handleAreaClick, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      measurementHandler.setInputAction(() => {
        if (measurementState.points.length >= 3) {
          const results = model.get("measurement_results") || [];
          const lastResult = results[results.length - 1];
          if (lastResult && lastResult.isActive) {
            const newResults = [...results];
            const { isActive, ...finalResult } = lastResult;
            newResults[newResults.length - 1] = finalResult;
            model.set("measurement_results", newResults);
            model.save_changes();
          }
          measurementState.points = [];
        }
      }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    }
  }

  // ============= LOAD MEASUREMENTS =============

  function loadAndDisplayMeasurements(measurements) {
    if (!Array.isArray(measurements)) return;

    measurements.forEach(measurement => {
      const { type, points } = measurement;
      if (!type || !Array.isArray(points) || points.length < 2) return;

      // Convert GeoJSON [lon, lat, alt] to Cartesian3
      const positions = points.map(point => {
        const [lon, lat, alt] = point;
        return Cesium.Cartesian3.fromDegrees(lon, lat, alt || 0);
      });

      if (type === "distance" && positions.length === 2) {
        displayDistance(positions);
      } else if (type === "multi-distance" && positions.length >= 2) {
        displayMultiDistance(positions);
      } else if (type === "height" && positions.length === 2) {
        displayHeight(positions);
      } else if (type === "area" && positions.length >= 3) {
        displayArea(positions);
      }
    });
  }

  function displayDistance(positions) {
    positions.forEach(pos => addMarker(pos, Cesium.Color.RED));

    const line = viewer.entities.add({
      polyline: {
        positions: positions,
        width: 3,
        material: Cesium.Color.RED,
      },
    });
    measurementState.polylines.push(line);

    const distance = Cesium.Cartesian3.distance(positions[0], positions[1]);
    const midpoint = Cesium.Cartesian3.midpoint(positions[0], positions[1], new Cesium.Cartesian3());
    const distanceText = distance >= 1000 ? `${(distance / 1000).toFixed(2)} km` : `${distance.toFixed(2)} m`;
    addLabel(midpoint, distanceText);
  }

  function displayMultiDistance(positions) {
    positions.forEach(pos => addMarker(pos, Cesium.Color.BLUE));

    const line = viewer.entities.add({
      polyline: {
        positions: positions,
        width: 3,
        material: Cesium.Color.BLUE,
      },
    });
    measurementState.polylines.push(line);

    let totalDistance = 0;
    for (let i = 0; i < positions.length - 1; i++) {
      const segmentDistance = Cesium.Cartesian3.distance(positions[i], positions[i + 1]);
      totalDistance += segmentDistance;

      const midpoint = Cesium.Cartesian3.midpoint(positions[i], positions[i + 1], new Cesium.Cartesian3());
      const segmentText = segmentDistance >= 1000 ? `${(segmentDistance / 1000).toFixed(2)} km` : `${segmentDistance.toFixed(2)} m`;
      addLabel(midpoint, segmentText);
    }

    const lastPos = positions[positions.length - 1];
    const totalText = totalDistance >= 1000 ? `Total: ${(totalDistance / 1000).toFixed(2)} km` : `Total: ${totalDistance.toFixed(2)} m`;
    addLabel(lastPos, totalText);
  }

  function displayHeight(positions) {
    positions.forEach(pos => addMarker(pos, Cesium.Color.GREEN));

    const carto0 = Cesium.Cartographic.fromCartesian(positions[0]);
    const carto1 = Cesium.Cartographic.fromCartesian(positions[1]);
    const verticalDistance = Math.abs(carto1.height - carto0.height);

    const line = viewer.entities.add({
      polyline: {
        positions: [
          positions[0],
          Cesium.Cartesian3.fromRadians(carto1.longitude, carto1.latitude, carto0.height),
          positions[1],
        ],
        width: 3,
        material: Cesium.Color.GREEN,
      },
    });
    measurementState.polylines.push(line);

    const midHeight = (carto0.height + carto1.height) / 2;
    const labelPos = Cesium.Cartesian3.fromRadians(carto1.longitude, carto1.latitude, midHeight);
    const heightText = verticalDistance >= 1000 ? `${(verticalDistance / 1000).toFixed(2)} km` : `${verticalDistance.toFixed(2)} m`;
    addLabel(labelPos, heightText);
  }

  function displayArea(positions) {
    positions.forEach(pos => addMarker(pos, Cesium.Color.ORANGE));

    const polygon = viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        material: Cesium.Color.ORANGE.withAlpha(0.3),
        outline: true,
        outlineColor: Cesium.Color.ORANGE,
        outlineWidth: 2,
      },
    });
    measurementState.polylines.push(polygon);

    // Calculate area using Cesium's PolygonGeometry
    const polygonHierarchy = new Cesium.PolygonHierarchy(positions);
    const geometry = Cesium.PolygonGeometry.createGeometry(
      new Cesium.PolygonGeometry({
        polygonHierarchy: polygonHierarchy,
        perPositionHeight: false,
        arcType: Cesium.ArcType.GEODESIC
      })
    );

    let area = 0;
    if (geometry) {
      const positionsArray = geometry.attributes.position.values;
      const indices = geometry.indices;

      for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i] * 3;
        const i1 = indices[i + 1] * 3;
        const i2 = indices[i + 2] * 3;

        const v0 = new Cesium.Cartesian3(positionsArray[i0], positionsArray[i0 + 1], positionsArray[i0 + 2]);
        const v1 = new Cesium.Cartesian3(positionsArray[i1], positionsArray[i1 + 1], positionsArray[i1 + 2]);
        const v2 = new Cesium.Cartesian3(positionsArray[i2], positionsArray[i2 + 1], positionsArray[i2 + 2]);

        const edge1 = Cesium.Cartesian3.subtract(v1, v0, new Cesium.Cartesian3());
        const edge2 = Cesium.Cartesian3.subtract(v2, v0, new Cesium.Cartesian3());
        const crossProduct = Cesium.Cartesian3.cross(edge1, edge2, new Cesium.Cartesian3());
        const triangleArea = Cesium.Cartesian3.magnitude(crossProduct) / 2.0;

        area += triangleArea;
      }
    }

    // Calculate centroid and place label at ground level
    let centroidLon = 0, centroidLat = 0;
    positions.forEach(pos => {
      const carto = Cesium.Cartographic.fromCartesian(pos);
      centroidLon += carto.longitude;
      centroidLat += carto.latitude;
    });
    centroidLon /= positions.length;
    centroidLat /= positions.length;

    const areaText = area >= 1000000 ? `${(area / 1000000).toFixed(2)} km²` : `${area.toFixed(2)} m²`;

    const centroidCarto = new Cesium.Cartographic(centroidLon, centroidLat);
    const promise = Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [centroidCarto]);
    promise.then(() => {
      const centroid = Cesium.Cartographic.toCartesian(centroidCarto);
      addLabel(centroid, areaText);
    });
  }

  // ============= MODEL LISTENERS =============

  model.on("change:measurement_mode", () => {
    if (isDestroyed) {
      console.log('[CesiumWidget:MeasurementTools] Skipping measurement_mode change - destroyed');
      return;
    }
    const mode = model.get("measurement_mode");
    console.log('[CesiumWidget:MeasurementTools] Measurement mode changed:', mode);
    enableMeasurementMode(mode);
  });

  model.on("change:measurement_results", () => {
    if (isDestroyed) {
      console.log('[CesiumWidget:MeasurementTools] Skipping measurement_results change - destroyed');
      return;
    }
    const results = model.get("measurement_results") || [];
    console.log('[CesiumWidget:MeasurementTools] Measurement results changed, count:', results.length);
    if (results.length === 0) {
      clearAllMeasurements();
    }
    updateMeasurementsList();
  });

  model.on("change:load_measurements_trigger", () => {
    if (isDestroyed) return;
    const triggerData = model.get("load_measurements_trigger");
    console.log('[CesiumWidget:MeasurementTools] Load measurements trigger:', triggerData);
    if (triggerData && triggerData.measurements) {
      loadAndDisplayMeasurements(triggerData.measurements);
      updateMeasurementsList();
    }
  });

  model.on("change:focus_measurement_trigger", () => {
    if (isDestroyed) return;
    const triggerData = model.get("focus_measurement_trigger");
    console.log('[CesiumWidget:MeasurementTools] Focus measurement trigger:', triggerData);
    if (triggerData && typeof triggerData.index === 'number') {
      focusOnMeasurement(triggerData.index);
    }
  });

  model.on("change:show_measurement_tools", () => {
    if (isDestroyed) return;
    const show = model.get("show_measurement_tools");
    console.log('[CesiumWidget:MeasurementTools] Show measurement tools:', show);
    toolbarDiv.style.display = show ? 'flex' : 'none';
    editorPanel.style.display = show ? editorPanel.style.display : 'none';

    // If hiding tools, disable edit mode
    if (!show && editState.enabled) {
      editState.enabled = false;
      disableEditMode();
    }
  });

  model.on("change:show_measurements_list", () => {
    if (isDestroyed) return;
    const show = model.get("show_measurements_list");
    console.log('[CesiumWidget:MeasurementTools] Show measurements list:', show);
    measurementsListPanel.style.display = show ? 'block' : 'none';
  });

  // Initialize visibility based on initial values
  toolbarDiv.style.display = model.get("show_measurement_tools") ? 'flex' : 'none';
  measurementsListPanel.style.display = model.get("show_measurements_list") ? 'block' : 'none';

  // Initialize measurements list
  updateMeasurementsList();

  // ============= PUBLIC API =============

  return {
    enableMeasurementMode,
    clearAllMeasurements,
    destroy: () => {
      console.log('[CesiumWidget:MeasurementTools] Destroying measurement tools');
      isDestroyed = true;
      if (measurementHandler) {
        measurementHandler.destroy();
      }
      clearAllMeasurements();
      if (toolbarDiv.parentNode) {
        toolbarDiv.remove();
      }
      console.log('[CesiumWidget:MeasurementTools] Measurement tools destroyed');
    }
  };
}
