/**
 * Measurement Tools Module
 * 
 * Handles all measurement functionality including distance, multi-distance,
 * height, and area measurements.
 */

import { log, warn, error } from './logger.js';

const PREFIX = 'Measurements';

// ============= CONSTANTS =============

const CONSTANTS = {
  // UI Dimensions
  MARKER_SIZE: 10,
  MARKER_SIZE_HOVER: 12,
  MARKER_SIZE_SELECTED: 15,
  MARKER_OUTLINE_WIDTH: 2,
  MARKER_OUTLINE_WIDTH_HOVER: 3,
  MARKER_OUTLINE_WIDTH_SELECTED: 4,
  
  // Panel Dimensions
  PANEL_MIN_WIDTH: 250,
  PANEL_MIN_HEIGHT: 200,
  PANEL_MAX_WIDTH: 600,
  PANEL_MAX_HEIGHT: 800,
  
  // Measurement Thresholds
  MAX_ADD_POINT_DISTANCE_METERS: 50,
  AREA_UNIT_THRESHOLD: 1000000, // m² to km² conversion
  DISTANCE_UNIT_THRESHOLD: 1000, // m to km conversion
  
  // Visual
  POLYLINE_WIDTH: 3,
  LABEL_PIXEL_OFFSET_Y: -20,
  POLYGON_ALPHA: 0.3,
  POLYGON_OUTLINE_WIDTH: 2,
};

// ============= SHARED UTILITIES =============

/**
 * Get color configuration for measurement types
 * Using a getter function to access Cesium after it's loaded
 */
function getColors() {
  const Cesium = window.Cesium;
  return {
    distance: { main: Cesium.Color.RED, button: '#e74c3c' },
    'multi-distance': { main: Cesium.Color.BLUE, button: '#3498db' },
    height: { main: Cesium.Color.GREEN, button: '#2ecc71' },
    area: { main: Cesium.Color.ORANGE, button: '#e67e22' },
  };
}

const TYPE_LABELS = {
  distance: 'Distance',
  'multi-distance': 'Multi-Distance',
  height: 'Height',
  area: 'Area',
};

/**
 * Calculate geodesic area from Cartesian3 positions using Cesium's PolygonGeometry
 */
function calculateGeodesicArea(positions) {
  const Cesium = window.Cesium;
  const polygonHierarchy = new Cesium.PolygonHierarchy(positions);
  const geometry = Cesium.PolygonGeometry.createGeometry(
    new Cesium.PolygonGeometry({
      polygonHierarchy: polygonHierarchy,
      perPositionHeight: false,
      arcType: Cesium.ArcType.GEODESIC
    })
  );

  if (!geometry) return 0;

  const positionsArray = geometry.attributes.position.values;
  const indices = geometry.indices;
  let area = 0;

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
    area += Cesium.Cartesian3.magnitude(crossProduct) / 2.0;
  }

  return area;
}

/**
 * Calculate centroid of positions in geographic coordinates
 */
function calculateCentroid(positions) {
  const Cesium = window.Cesium;
  let centroidLon = 0, centroidLat = 0;
  positions.forEach(pos => {
    const carto = Cesium.Cartographic.fromCartesian(pos);
    centroidLon += carto.longitude;
    centroidLat += carto.latitude;
  });
  return new Cesium.Cartographic(centroidLon / positions.length, centroidLat / positions.length);
}

/**
 * Format distance or area value with appropriate units
 */
function formatValue(value, isArea = false) {
  if (isArea) {
    return value >= CONSTANTS.AREA_UNIT_THRESHOLD 
      ? `${(value / CONSTANTS.AREA_UNIT_THRESHOLD).toFixed(2)} km²` 
      : `${value.toFixed(2)} m²`;
  }
  return value >= CONSTANTS.DISTANCE_UNIT_THRESHOLD 
    ? `${(value / CONSTANTS.DISTANCE_UNIT_THRESHOLD).toFixed(2)} km` 
    : `${value.toFixed(2)} m`;
}

/**
 * Create a styled button element
 */
function createStyledButton(text, baseColor, activeColor = '#e74c3c') {
  const btn = document.createElement("button");
  btn.textContent = text;
  btn.dataset.baseColor = baseColor;
  btn.dataset.activeColor = activeColor;
  btn.style.cssText = `
    padding: 8px 12px;
    background: ${baseColor};
    color: white;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    transition: background 0.2s;
  `;
  return btn;
}

/**
 * Make a panel draggable by its header
 * @param {HTMLElement} panel - The panel element to make draggable
 * @param {HTMLElement} handle - The drag handle element (usually header)
 * @returns {Function} Cleanup function to remove event listeners
 */
function makeDraggable(panel, handle) {
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  handle.style.cursor = 'move';

  const handleMouseDown = (e) => {
    // Only start drag on left mouse button and if not clicking a button
    if (e.button !== 0 || e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = panel.getBoundingClientRect();
    const parentRect = panel.parentElement.getBoundingClientRect();
    initialLeft = rect.left - parentRect.left;
    initialTop = rect.top - parentRect.top;
    
    // Clear any right/bottom positioning and switch to left/top
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.left = initialLeft + 'px';
    panel.style.top = initialTop + 'px';
    
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    const parentRect = panel.parentElement.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    
    // Calculate new position with bounds checking
    let newLeft = initialLeft + deltaX;
    let newTop = initialTop + deltaY;
    
    // Keep panel within container bounds
    newLeft = Math.max(0, Math.min(newLeft, parentRect.width - panelRect.width));
    newTop = Math.max(0, Math.min(newTop, parentRect.height - panelRect.height));
    
    panel.style.left = newLeft + 'px';
    panel.style.top = newTop + 'px';
  };

  const handleMouseUp = () => {
    isDragging = false;
  };

  handle.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // Return cleanup function
  return () => {
    handle.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}

/**
 * Make a panel resizable by adding resize handles
 * @param {HTMLElement} panel - The panel element to make resizable
 * @param {number} minWidth - Minimum width in pixels
 * @param {number} minHeight - Minimum height in pixels
 * @param {number} maxWidth - Maximum width in pixels
 * @param {number} maxHeight - Maximum height in pixels
 * @returns {Function} Cleanup function to remove event listeners and handle
 */
function makeResizable(panel, minWidth = CONSTANTS.PANEL_MIN_WIDTH, minHeight = CONSTANTS.PANEL_MIN_HEIGHT, maxWidth = CONSTANTS.PANEL_MAX_WIDTH, maxHeight = CONSTANTS.PANEL_MAX_HEIGHT) {
  const resizeHandle = document.createElement('div');
  resizeHandle.style.cssText = `
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 20px;
    height: 20px;
    cursor: nwse-resize;
    z-index: 1002;
  `;
  
  // Visual indicator for resize handle
  resizeHandle.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 20 20" style="pointer-events: none;">
      <path d="M 20 0 L 20 20 L 0 20" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
      <path d="M 14 20 L 20 14" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
      <path d="M 8 20 L 20 8" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
    </svg>
  `;
  
  panel.appendChild(resizeHandle);
  
  let isResizing = false;
  let startX, startY, startWidth, startHeight;
  
  const handleMouseDown = (e) => {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = panel.getBoundingClientRect();
    startWidth = rect.width;
    startHeight = rect.height;
    
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleMouseMove = (e) => {
    if (!isResizing) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    let newWidth = startWidth + deltaX;
    let newHeight = startHeight + deltaY;
    
    // Apply min/max constraints
    newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
    newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));
    
    panel.style.width = newWidth + 'px';
    panel.style.height = newHeight + 'px';
    panel.style.maxWidth = 'none'; // Override inline max-width when resizing
    panel.style.maxHeight = 'none'; // Override inline max-height when resizing
  };
  
  const handleMouseUp = () => {
    isResizing = false;
  };

  resizeHandle.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // Return cleanup function
  return () => {
    resizeHandle.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    if (resizeHandle.parentNode) {
      resizeHandle.remove();
    }
  };
}

/**
 * Initialize measurement tools for a Cesium viewer
 * @param {Object} viewer - Cesium Viewer instance
 * @param {Object} model - Anywidget traitlet model
 * @param {HTMLElement} container - Container element for toolbar
 * @returns {Object} Measurement tools API
 */
export function initializeMeasurementTools(viewer, model, container) {
  log(PREFIX, 'Initializing measurement tools');
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
    addPointMode: false,
  };

  // Store cleanup functions for event listeners
  const cleanupFunctions = [];

  // ============= UI CREATION =============

  const toolbarDiv = document.createElement("div");
  toolbarDiv.style.cssText = `
    position: absolute;
    top: 10px;
    left: 10px;
    background: rgba(42, 42, 42, 0.9);
    padding: 0;
    border-radius: 5px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 0;
  `;
  container.appendChild(toolbarDiv);

  // Toolbar header (drag handle)
  const toolbarHeader = document.createElement("div");
  toolbarHeader.style.cssText = `
    padding: 8px 10px;
    background: rgba(60, 60, 60, 0.95);
    border-radius: 5px 5px 0 0;
    font-family: sans-serif;
    font-size: 11px;
    color: #aaa;
    border-bottom: 1px solid #555;
    user-select: none;
  `;
  toolbarHeader.textContent = '⋮⋮ Measurement Tools';
  toolbarDiv.appendChild(toolbarHeader);

  // Toolbar content
  const toolbarContent = document.createElement("div");
  toolbarContent.style.cssText = `
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  `;
  toolbarDiv.appendChild(toolbarContent);

  cleanupFunctions.push(makeDraggable(toolbarDiv, toolbarHeader));

  function setupButtonHover(btn, hoverColor, getActiveState = () => false) {
    const baseColor = btn.dataset.baseColor;
    btn.onmouseover = () => { btn.style.background = hoverColor; };
    btn.onmouseout = () => {
      btn.style.background = getActiveState() ? btn.dataset.activeColor : baseColor;
    };
  }

  function createMeasurementButton(text, mode) {
    const btn = createStyledButton(text, '#3498db');
    setupButtonHover(btn, '#2980b9', () => measurementState.mode === mode);
    btn.onclick = () => {
      model.set("measurement_mode", measurementState.mode === mode ? "" : mode);
      model.save_changes();
    };
    return btn;
  }

  const modeButtons = {
    distance: createMeasurementButton("📏 Distance", "distance"),
    'multi-distance': createMeasurementButton("📐 Multi Distance", "multi-distance"),
    height: createMeasurementButton("📊 Height", "height"),
    area: createMeasurementButton("⬛ Area", "area"),
  };

  const clearBtn = createStyledButton("🗑️ Clear", '#e74c3c');
  setupButtonHover(clearBtn, '#c0392b');
  clearBtn.onclick = () => {
    clearAllMeasurements();
    model.set("measurement_mode", "");
    model.set("measurement_results", []);
    model.save_changes();
  };

  Object.values(modeButtons).forEach(btn => toolbarContent.appendChild(btn));
  toolbarContent.appendChild(clearBtn);

  const editBtn = createStyledButton("✏️ Edit Points", '#9b59b6');
  setupButtonHover(editBtn, '#8e44ad', () => editState.enabled);
  editBtn.onclick = () => {
    editState.enabled = !editState.enabled;
    editBtn.style.background = editState.enabled ? '#e74c3c' : '#9b59b6';
    editState.enabled ? enableEditMode() : disableEditMode();
  };
  toolbarContent.appendChild(editBtn);

  const addPointBtn = createStyledButton("➕ Add Point", '#16a085');
  addPointBtn.style.display = 'none'; // Hidden until edit mode is enabled
  setupButtonHover(addPointBtn, '#138d75', () => editState.addPointMode);
  addPointBtn.onclick = () => {
    editState.addPointMode = !editState.addPointMode;
    addPointBtn.style.background = editState.addPointMode ? '#e74c3c' : '#16a085';
    if (editState.addPointMode) {
      deselectPoint(); // Deselect any selected point when entering add mode
    }
  };
  toolbarContent.appendChild(addPointBtn);

  // Coordinate editor panel
  const editorPanel = document.createElement("div");
  editorPanel.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(42, 42, 42, 0.95);
    padding: 0;
    border-radius: 5px;
    z-index: 1000;
    display: none;
    color: white;
    font-family: sans-serif;
    font-size: 12px;
    min-width: 250px;
  `;

  // Editor panel header (drag handle)
  const editorHeader = document.createElement("div");
  editorHeader.style.cssText = `
    padding: 10px 15px;
    background: rgba(60, 60, 60, 0.95);
    border-radius: 5px 5px 0 0;
    font-weight: bold;
    border-bottom: 1px solid #555;
    user-select: none;
    cursor: move;
  `;
  editorHeader.textContent = '⋮⋮ Edit Point';
  editorPanel.appendChild(editorHeader);

  // Editor panel content
  const editorContent = document.createElement("div");
  editorContent.style.cssText = `padding: 15px;`;
  editorPanel.appendChild(editorContent);

  container.appendChild(editorPanel);
  cleanupFunctions.push(makeDraggable(editorPanel, editorHeader));

  // Measurements list panel
  const measurementsListPanel = document.createElement("div");
  measurementsListPanel.style.cssText = `
    position: absolute;
    bottom: 10px;
    right: 10px;
    background: rgba(42, 42, 42, 0.95);
    padding: 0;
    border-radius: 5px;
    z-index: 1000;
    color: white;
    font-family: sans-serif;
    font-size: 12px;
    width: 350px;
    height: 400px;
    min-width: 250px;
    min-height: 200px;
    max-width: 600px;
    max-height: 800px;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    overflow: hidden;
  `;

  // Measurements list header (drag handle)
  const measurementsHeader = document.createElement("div");
  measurementsHeader.style.cssText = `
    padding: 10px 15px;
    background: rgba(60, 60, 60, 0.95);
    border-radius: 5px 5px 0 0;
    font-weight: bold;
    border-bottom: 1px solid #555;
    user-select: none;
    cursor: move;
    flex-shrink: 0;
    box-sizing: border-box;
  `;
  measurementsHeader.textContent = '⋮⋮ Measurements';
  measurementsListPanel.appendChild(measurementsHeader);

  // Measurements list content
  const measurementsContent = document.createElement("div");
  measurementsContent.className = 'measurement-panel-scrollable';
  measurementsContent.style.cssText = `
    padding: 10px 15px 25px 15px;
    overflow-y: scroll;
    overflow-x: hidden;
    flex: 1 1 auto;
    min-height: 0;
    max-height: 100%;
    word-wrap: break-word;
    overflow-wrap: break-word;
    box-sizing: border-box;
    position: relative;
    z-index: 1;
  `;
  measurementsContent.innerHTML = `<div id="measurements-list-content" style="width: 100%; box-sizing: border-box;"></div>`;
  measurementsListPanel.appendChild(measurementsContent);

  container.appendChild(measurementsListPanel);
  cleanupFunctions.push(makeDraggable(measurementsListPanel, measurementsHeader));
  cleanupFunctions.push(makeResizable(measurementsListPanel));

  // ============= HELPER FUNCTIONS =============

  function getPosition(screenPosition) {
    try {
      const pickedObject = viewer.scene.pick(screenPosition);
      if (viewer.scene.pickPositionSupported && Cesium.defined(pickedObject)) {
        const cartesian = viewer.scene.pickPosition(screenPosition);
        if (Cesium.defined(cartesian)) {
          return cartesian;
        }
      }
      const ray = viewer.camera.getPickRay(screenPosition);
      if (!ray) {
        warn(PREFIX, 'Unable to get pick ray from camera');
        return null;
      }
      return viewer.scene.globe.pick(ray, viewer.scene);
    } catch (err) {
      error(PREFIX, 'Error getting position:', err);
      return null;
    }
  }

  function addMarker(position, color = Cesium.Color.RED) {
    const marker = viewer.entities.add({
      position: position,
      point: {
        pixelSize: CONSTANTS.MARKER_SIZE,
        color: color,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: CONSTANTS.MARKER_OUTLINE_WIDTH,
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
        pixelOffset: new Cesium.Cartesian2(0, CONSTANTS.LABEL_PIXEL_OFFSET_Y),
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

  function updateOrCreateMeasurement(type, value, points) {
    const results = model.get("measurement_results") || [];
    const lastResult = results[results.length - 1];
    const isActiveType = lastResult && lastResult.type === type && lastResult.isActive;
    
    let newResults;
    if (isActiveType) {
      newResults = [...results];
      newResults[newResults.length - 1] = { ...lastResult, value, points };
    } else {
      const count = results.filter(r => r.type === type).length + 1;
      newResults = [...results, {
        type,
        value,
        points,
        isActive: type === 'multi-distance' || type === 'area',
        name: `${TYPE_LABELS[type]} ${count}`,
      }];
    }
    model.set("measurement_results", newResults);
    model.save_changes();
  }

  function clearAllMeasurements() {
    log(PREFIX, 'Clearing all measurements');
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

    // Show add point button
    addPointBtn.style.display = 'block';

    // Highlight all measurement points to make them selectable
    measurementState.entities.forEach(entity => {
      if (entity.point) {
        entity.point.pixelSize = CONSTANTS.MARKER_SIZE_HOVER;
        entity.point.outlineWidth = CONSTANTS.MARKER_OUTLINE_WIDTH_HOVER;
      }
    });

    // Set up edit handlers
    editHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    editHandler.setInputAction((click) => {
      if (editState.addPointMode) {
        handleAddPointClick(click);
      } else {
        const pickedObject = viewer.scene.pick(click.position);
        if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.point) {
          selectPoint(pickedObject.id, click.position);
        } else {
          deselectPoint();
        }
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
      if (editState.selectedEntity && !editState.addPointMode) {
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

    // Hide add point button
    addPointBtn.style.display = 'none';
    editState.addPointMode = false;
    addPointBtn.style.background = '#16a085';

    deselectPoint();

    // Reset point sizes
    measurementState.entities.forEach(entity => {
      if (entity.point) {
        entity.point.pixelSize = CONSTANTS.MARKER_SIZE;
        entity.point.outlineWidth = CONSTANTS.MARKER_OUTLINE_WIDTH;
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
    entity.point.pixelSize = CONSTANTS.MARKER_SIZE_SELECTED;
    entity.point.outlineWidth = CONSTANTS.MARKER_OUTLINE_WIDTH_SELECTED;
    entity.point.outlineColor = Cesium.Color.YELLOW;

    // Show coordinate editor
    showCoordinateEditor(results[measurementIndex], pointIndex);
  }

  function deselectPoint() {
    if (editState.selectedEntity && editState.selectedEntity.point) {
      editState.selectedEntity.point.pixelSize = CONSTANTS.MARKER_SIZE_HOVER;
      editState.selectedEntity.point.outlineWidth = CONSTANTS.MARKER_OUTLINE_WIDTH_HOVER;
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

    // Update header text
    editorHeader.textContent = `⋮⋮ Edit Point ${pointIndex + 1} (${measurement.type})`;

    editorContent.innerHTML = `
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
      warn(PREFIX, "Editor panel input elements not found in DOM");
    }

    if (applyBtn) {
      applyBtn.onclick = () => {
        if (!editLonInput || !editLatInput || !editAltInput) {
          warn(PREFIX, "Editor input fields not available");
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
            material: Cesium.Color.ORANGE.withAlpha(CONSTANTS.POLYGON_ALPHA),
            outline: true,
            outlineColor: Cesium.Color.ORANGE,
            outlineWidth: CONSTANTS.POLYGON_OUTLINE_WIDTH,
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
    const labelStartIndex = editState.measurementIndex;

    if (type === "distance") {
      const distance = Cesium.Cartesian3.distance(positions[0], positions[1]);
      const midpoint = Cesium.Cartesian3.midpoint(positions[0], positions[1], new Cesium.Cartesian3());

      if (measurementState.labels[labelStartIndex]) {
        measurementState.labels[labelStartIndex].position = midpoint;
        measurementState.labels[labelStartIndex].label.text = formatValue(distance);
      }
    } else if (type === "height") {
      const carto0 = Cesium.Cartographic.fromCartesian(positions[0]);
      const carto1 = Cesium.Cartographic.fromCartesian(positions[1]);
      const verticalDistance = Math.abs(carto1.height - carto0.height);
      const midHeight = (carto0.height + carto1.height) / 2;
      const labelPos = Cesium.Cartesian3.fromRadians(carto1.longitude, carto1.latitude, midHeight);

      if (measurementState.labels[labelStartIndex]) {
        measurementState.labels[labelStartIndex].position = labelPos;
        measurementState.labels[labelStartIndex].label.text = formatValue(verticalDistance);
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
      measurement.value = calculateGeodesicArea(positions);
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

  function handleAddPointClick(click) {
    const position = getPosition(click.position);
    if (!position) {
      log(PREFIX, 'No valid position for add point');
      return;
    }

    const results = model.get("measurement_results") || [];
    
    // Find the nearest line segment across all measurements
    let nearestMeasurement = null;
    let nearestSegment = null;
    let minDistance = Number.POSITIVE_INFINITY;
    let insertIndex = -1;

    for (let measIdx = 0; measIdx < results.length; measIdx++) {
      const measurement = results[measIdx];
      
      // Only allow adding points to multi-distance and area measurements
      if (measurement.type !== 'multi-distance' && measurement.type !== 'area') {
        continue;
      }

      // Get entity positions for this measurement
      let entityStartIndex = 0;
      for (let i = 0; i < measIdx; i++) {
        entityStartIndex += results[i].points.length;
      }

      const positions = [];
      for (let i = 0; i < measurement.points.length; i++) {
        const entity = measurementState.entities[entityStartIndex + i];
        if (entity && entity.position) {
          positions.push(entity.position.getValue(Cesium.JulianDate.now()));
        }
      }

      // Check distance to each line segment
      for (let i = 0; i < positions.length - 1; i++) {
        const p1 = positions[i];
        const p2 = positions[i + 1];
        const closestPoint = closestPointOnSegment(position, p1, p2);
        const dist = Cesium.Cartesian3.distance(position, closestPoint);
        
        if (dist < minDistance) {
          minDistance = dist;
          nearestMeasurement = measIdx;
          nearestSegment = { start: p1, end: p2 };
          insertIndex = i + 1; // Insert after the start point of the segment
        }
      }

      // For area measurements, also check the closing segment
      if (measurement.type === 'area' && positions.length > 2) {
        const p1 = positions[positions.length - 1];
        const p2 = positions[0];
        const closestPoint = closestPointOnSegment(position, p1, p2);
        const dist = Cesium.Cartesian3.distance(position, closestPoint);
        
        if (dist < minDistance) {
          minDistance = dist;
          nearestMeasurement = measIdx;
          nearestSegment = { start: p1, end: p2 };
          insertIndex = positions.length; // Insert at the end (before wrapping to start)
        }
      }
    }

    // If we found a nearby segment (within reasonable distance), add the point
    if (nearestMeasurement !== null && minDistance < CONSTANTS.MAX_ADD_POINT_DISTANCE_METERS) {
      addPointToMeasurement(nearestMeasurement, insertIndex, position);
    } else {
      log(PREFIX, 'No nearby line segment found to add point (min distance:', minDistance.toFixed(2), 'm)');
    }
  }

  function closestPointOnSegment(point, segStart, segEnd) {
    const segmentVector = Cesium.Cartesian3.subtract(segEnd, segStart, new Cesium.Cartesian3());
    const pointVector = Cesium.Cartesian3.subtract(point, segStart, new Cesium.Cartesian3());
    
    const segmentLength = Cesium.Cartesian3.magnitude(segmentVector);
    if (segmentLength === 0) return segStart;
    
    const normalizedSegment = Cesium.Cartesian3.normalize(segmentVector, new Cesium.Cartesian3());
    const projection = Cesium.Cartesian3.dot(pointVector, normalizedSegment);
    
    // Clamp to segment
    const t = Math.max(0, Math.min(segmentLength, projection));
    
    const closestPoint = Cesium.Cartesian3.add(
      segStart,
      Cesium.Cartesian3.multiplyByScalar(normalizedSegment, t, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );
    
    return closestPoint;
  }

  function addPointToMeasurement(measurementIndex, insertIndex, position) {
    const results = model.get("measurement_results") || [];
    const measurement = results[measurementIndex];
    
    // Convert position to lat/lon/alt
    const cartographic = Cesium.Cartographic.fromCartesian(position);
    const newPoint = {
      lat: Cesium.Math.toDegrees(cartographic.latitude),
      lon: Cesium.Math.toDegrees(cartographic.longitude),
      alt: cartographic.height,
    };
    
    // Insert the point into the measurement
    measurement.points.splice(insertIndex, 0, newPoint);
    
    // Get the color for this measurement type
    const colors = getColors();
    const color = colors[measurement.type]?.main || Cesium.Color.WHITE;
    
    // Create a new marker for the point
    const marker = addMarker(position, color);
    
    // Find where to insert the marker in the entities array
    let entityInsertIndex = 0;
    for (let i = 0; i < measurementIndex; i++) {
      entityInsertIndex += results[i].points.length;
    }
    entityInsertIndex += insertIndex;
    
    // Insert the marker at the correct position
    measurementState.entities.splice(entityInsertIndex, 0, marker);
    
    // Recalculate measurement value
    const positions = [];
    let entityStartIndex = 0;
    for (let i = 0; i < measurementIndex; i++) {
      entityStartIndex += results[i].points.length;
    }
    
    for (let i = 0; i < measurement.points.length; i++) {
      const entity = measurementState.entities[entityStartIndex + i];
      if (entity && entity.position) {
        positions.push(entity.position.getValue(Cesium.JulianDate.now()));
      }
    }
    
    if (measurement.type === "multi-distance") {
      let totalDistance = 0;
      for (let i = 0; i < positions.length - 1; i++) {
        totalDistance += Cesium.Cartesian3.distance(positions[i], positions[i + 1]);
      }
      measurement.value = totalDistance;
    } else if (measurement.type === "area") {
      measurement.value = calculateGeodesicArea(positions);
    }
    
    // Update visual elements
    updateMeasurementVisualsForIndex(measurementIndex);
    
    // Sync to Python
    const newResults = [...results];
    model.set("measurement_results", newResults);
    model.save_changes();
    
    // Update measurements list
    updateMeasurementsList();
    
    log(PREFIX, `Added point to ${measurement.type} measurement at index ${insertIndex}`);
  }

  function updateMeasurementVisualsForIndex(measurementIndex) {
    const results = model.get("measurement_results") || [];
    const measurement = results[measurementIndex];

    // Collect all entity positions for this measurement
    let entityStartIndex = 0;
    for (let i = 0; i < measurementIndex; i++) {
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
    const colors = getColors();
    const color = colors[measurement.type]?.main || Cesium.Color.WHITE;

    if (measurementState.polylines[measurementIndex]) {
      viewer.entities.remove(measurementState.polylines[measurementIndex]);
    }

    if (measurement.type === "multi-distance") {
      const polyline = viewer.entities.add({
        polyline: {
          positions: positions,
          width: CONSTANTS.POLYLINE_WIDTH,
          material: color,
          clampToGround: false,
        },
      });
      measurementState.polylines[measurementIndex] = polyline;

      // Update labels for each segment
      // Remove old labels for this measurement
      const labelStartIndex = measurementIndex * 20; // Estimate - we need better tracking
      // For now, just clear and recreate all labels
      
    } else if (measurement.type === "area") {
      const polygon = viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions),
          material: Cesium.Color.fromAlpha(color, CONSTANTS.POLYGON_ALPHA),
          outline: true,
          outlineColor: color,
          outlineWidth: CONSTANTS.POLYGON_OUTLINE_WIDTH,
          perPositionHeight: true,
        },
      });
      measurementState.polylines[measurementIndex] = polygon;
    }
  }

  // ============= MEASUREMENTS LIST FUNCTIONS =============

  function updateMeasurementsList() {
    const results = model.get("measurement_results") || [];
    log(PREFIX, 'Updating measurements list, count:', results.length);
    const listContent = document.getElementById("measurements-list-content");

    if (!listContent) {
      warn(PREFIX, "Measurements list content element not found in DOM");
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
        box-sizing: border-box;
        width: 100%;
        word-wrap: break-word;
        overflow-wrap: break-word;
        overflow: hidden;
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
        gap: 8px;
      `;
      nameDiv.innerHTML = `
        <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;">${name}</span>
        <button id="rename-${index}" style="padding: 2px 6px; background: #3498db; color: white; border: none; border-radius: 2px; cursor: pointer; font-size: 10px; flex-shrink: 0;">✎</button>
      `;
      measurementDiv.appendChild(nameDiv);

      // Measurement value
      const valueDiv = document.createElement("div");
      valueDiv.style.cssText = 'color: #aaa; font-size: 11px; margin-bottom: 3px;';
      valueDiv.textContent = formatValue(measurement.value, measurement.type === 'area');
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
        warn(PREFIX, `Rename button not found for measurement ${index}`);
      }
    });
  }

  function getMeasurementColor(type) {
    return getColors()[type]?.button || '#95a5a6';
  }

  function getMeasurementTypeLabel(type) {
    return TYPE_LABELS[type] || type;
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
          width: CONSTANTS.POLYLINE_WIDTH,
          material: Cesium.Color.YELLOW,
          depthFailMaterial: Cesium.Color.YELLOW,
        },
      });
    } else if (measurementState.points.length === 1) {
      measurementState.points.push(position);
      addMarker(position);

      const distance = calculateDistance(measurementState.points[0], measurementState.points[1]);
      const midpoint = getMidpoint(measurementState.points[0], measurementState.points[1]);
      addLabel(midpoint, formatValue(distance));

      if (measurementState.tempPolyline) {
        viewer.entities.remove(measurementState.tempPolyline);
        measurementState.tempPolyline = null;
      }
      measurementState.polyline = viewer.entities.add({
        polyline: {
          positions: measurementState.points,
          width: CONSTANTS.POLYLINE_WIDTH,
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
          width: CONSTANTS.POLYLINE_WIDTH,
          material: Cesium.Color.BLUE,
          depthFailMaterial: Cesium.Color.BLUE,
        },
      });
      measurementState.polylines.push(measurementState.polyline);
    } else {
      const p1 = measurementState.points[measurementState.points.length - 2];
      const p2 = measurementState.points[measurementState.points.length - 1];
      const distance = calculateDistance(p1, p2);
      addLabel(getMidpoint(p1, p2), formatValue(distance));

      let totalDistance = 0;
      for (let i = 0; i < measurementState.points.length - 1; i++) {
        totalDistance += calculateDistance(measurementState.points[i], measurementState.points[i + 1]);
      }

      updateOrCreateMeasurement("multi-distance", totalDistance, measurementState.points.map(cartesianToLatLonAlt));
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
        width: CONSTANTS.POLYLINE_WIDTH,
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
          material: Cesium.Color.ORANGE.withAlpha(CONSTANTS.POLYGON_ALPHA),
          outline: true,
          outlineColor: Cesium.Color.ORANGE,
          outlineWidth: CONSTANTS.POLYGON_OUTLINE_WIDTH,
        },
      });
      measurementState.polylines.push(measurementState.polyline);
    }

    if (measurementState.points.length >= 3) {
      const positions = measurementState.points;
      const area = calculateGeodesicArea(positions);

      // Remove old area label if exists
      const oldLabel = measurementState.labels.find(l => l.label && l.label.text._value.includes('m²') || l.label.text._value.includes('km²'));
      if (oldLabel) {
        viewer.entities.remove(oldLabel);
        measurementState.labels = measurementState.labels.filter(l => l !== oldLabel);
      }

      // Sample terrain height at centroid and place label at ground level
      const centroidCarto = calculateCentroid(positions);
      Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [centroidCarto]).then(() => {
        addLabel(Cesium.Cartographic.toCartesian(centroidCarto), formatValue(area, true));
      });

      updateOrCreateMeasurement("area", area, measurementState.points.map(cartesianToLatLonAlt));
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
    log(PREFIX, 'Enabling measurement mode:', mode);
    if (measurementHandler) {
      measurementHandler.destroy();
      measurementHandler = null;
    }

    clearInProgressMeasurement();
    measurementState.mode = mode;

    // Update button styles
    Object.entries(modeButtons).forEach(([btnMode, btn]) => {
      btn.style.background = mode === btnMode ? '#e74c3c' : '#3498db';
    });

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
        width: CONSTANTS.POLYLINE_WIDTH,
        material: Cesium.Color.RED,
      },
    });
    measurementState.polylines.push(line);

    const distance = Cesium.Cartesian3.distance(positions[0], positions[1]);
    const midpoint = Cesium.Cartesian3.midpoint(positions[0], positions[1], new Cesium.Cartesian3());
    addLabel(midpoint, formatValue(distance));
  }

  function displayMultiDistance(positions) {
    positions.forEach(pos => addMarker(pos, Cesium.Color.BLUE));

    const line = viewer.entities.add({
      polyline: {
        positions: positions,
        width: CONSTANTS.POLYLINE_WIDTH,
        material: Cesium.Color.BLUE,
      },
    });
    measurementState.polylines.push(line);

    let totalDistance = 0;
    for (let i = 0; i < positions.length - 1; i++) {
      const segmentDistance = Cesium.Cartesian3.distance(positions[i], positions[i + 1]);
      totalDistance += segmentDistance;
      const midpoint = Cesium.Cartesian3.midpoint(positions[i], positions[i + 1], new Cesium.Cartesian3());
      addLabel(midpoint, formatValue(segmentDistance));
    }

    addLabel(positions[positions.length - 1], `Total: ${formatValue(totalDistance)}`);
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
        width: CONSTANTS.POLYLINE_WIDTH,
        material: Cesium.Color.GREEN,
      },
    });
    measurementState.polylines.push(line);

    const midHeight = (carto0.height + carto1.height) / 2;
    const labelPos = Cesium.Cartesian3.fromRadians(carto1.longitude, carto1.latitude, midHeight);
    addLabel(labelPos, formatValue(verticalDistance));
  }

  function displayArea(positions) {
    positions.forEach(pos => addMarker(pos, Cesium.Color.ORANGE));

    const polygon = viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        material: Cesium.Color.ORANGE.withAlpha(CONSTANTS.POLYGON_ALPHA),
        outline: true,
        outlineColor: Cesium.Color.ORANGE,
        outlineWidth: CONSTANTS.POLYGON_OUTLINE_WIDTH,
      },
    });
    measurementState.polylines.push(polygon);

    const area = calculateGeodesicArea(positions);
    const centroidCarto = calculateCentroid(positions);
    Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [centroidCarto]).then(() => {
      addLabel(Cesium.Cartographic.toCartesian(centroidCarto), formatValue(area, true));
    });
  }

  // ============= MODEL LISTENERS =============

  model.on("change:measurement_mode", () => {
    if (isDestroyed) {
      log(PREFIX, 'Skipping measurement_mode change - destroyed');
      return;
    }
    const mode = model.get("measurement_mode");
    log(PREFIX, 'Measurement mode changed:', mode);
    enableMeasurementMode(mode);
  });

  model.on("change:measurement_results", () => {
    if (isDestroyed) {
      log(PREFIX, 'Skipping measurement_results change - destroyed');
      return;
    }
    const results = model.get("measurement_results") || [];
    log(PREFIX, 'Measurement results changed, count:', results.length);
    if (results.length === 0) {
      clearAllMeasurements();
    }
    updateMeasurementsList();
  });

  model.on("change:load_measurements_trigger", () => {
    if (isDestroyed) return;
    const triggerData = model.get("load_measurements_trigger");
    log(PREFIX, 'Load measurements trigger:', triggerData);
    if (triggerData && triggerData.measurements) {
      loadAndDisplayMeasurements(triggerData.measurements);
      updateMeasurementsList();
    }
  });

  model.on("change:focus_measurement_trigger", () => {
    if (isDestroyed) return;
    const triggerData = model.get("focus_measurement_trigger");
    log(PREFIX, 'Focus measurement trigger:', triggerData);
    if (triggerData && typeof triggerData.index === 'number') {
      focusOnMeasurement(triggerData.index);
    }
  });

  model.on("change:show_measurement_tools", () => {
    if (isDestroyed) return;
    const show = model.get("show_measurement_tools");
    log(PREFIX, 'Show measurement tools:', show);
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
    log(PREFIX, 'Show measurements list:', show);
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
      log(PREFIX, 'Destroying measurement tools');
      isDestroyed = true;
      
      // Destroy handlers
      if (measurementHandler) {
        measurementHandler.destroy();
        measurementHandler = null;
      }
      if (editHandler) {
        editHandler.destroy();
        editHandler = null;
      }
      
      // Clean up all event listeners
      cleanupFunctions.forEach(cleanup => {
        try {
          cleanup();
        } catch (err) {
          warn(PREFIX, 'Error during cleanup:', err);
        }
      });
      cleanupFunctions.length = 0;
      
      // Clear measurements
      clearAllMeasurements();
      
      // Remove UI elements
      if (toolbarDiv.parentNode) {
        toolbarDiv.remove();
      }
      if (editorPanel.parentNode) {
        editorPanel.remove();
      }
      if (measurementsListPanel.parentNode) {
        measurementsListPanel.remove();
      }
      
      log(PREFIX, 'Measurement tools destroyed');
    }
  };
}
