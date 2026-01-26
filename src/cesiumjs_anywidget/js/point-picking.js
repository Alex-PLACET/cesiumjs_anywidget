/**
 * Point Picking Module
 * 
 * Handles 3D point picking in the Cesium scene for camera calibration.
 * Points can be picked by clicking on the terrain, 3D tiles, or other geometry.
 */

import { log, warn, error } from './logger.js';

const PREFIX = 'PointPicking';

/**
 * Initialize point picking functionality
 * @param {Object} viewer - Cesium Viewer instance
 * @param {Object} model - Anywidget model for state sync
 * @param {HTMLElement} container - Container element
 * @returns {Object} - Cleanup object with destroy method
 */
export function initializePointPicking(viewer, model, container) {
  const Cesium = window.Cesium;
  
  // State
  let handler = null;
  let pickedPointEntities = [];
  let isPickingMode = false;
  
  // UI Elements
  let pickingPanel = null;
  let statusText = null;
  
  /**
   * Create the picking UI panel
   */
  function createPickingPanel() {
    pickingPanel = document.createElement('div');
    pickingPanel.id = 'point-picking-panel';
    pickingPanel.style.cssText = `
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      font-family: sans-serif;
      font-size: 14px;
      z-index: 1000;
      display: none;
      pointer-events: none;
      text-align: center;
    `;
    
    statusText = document.createElement('span');
    statusText.textContent = '🎯 Point Picking Mode - Click on the scene to pick a point';
    pickingPanel.appendChild(statusText);
    
    container.appendChild(pickingPanel);
  }
  
  /**
   * Show/hide the picking panel
   */
  function setPickingPanelVisible(visible) {
    if (pickingPanel) {
      pickingPanel.style.display = visible ? 'block' : 'none';
    }
  }
  
  /**
   * Update status text
   */
  function updateStatus(text) {
    if (statusText) {
      statusText.textContent = text;
    }
  }
  
  /**
   * Get position from screen coordinates
   * Handles both terrain and 3D tiles
   */
  function getPositionFromScreen(screenPosition) {
    // First try to pick from 3D tiles or entities
    const pickedObject = viewer.scene.pick(screenPosition);
    if (viewer.scene.pickPositionSupported && Cesium.defined(pickedObject)) {
      const cartesian = viewer.scene.pickPosition(screenPosition);
      if (Cesium.defined(cartesian)) {
        return cartesian;
      }
    }
    
    // Fall back to globe/terrain picking
    const ray = viewer.camera.getPickRay(screenPosition);
    if (ray) {
      return viewer.scene.globe.pick(ray, viewer.scene);
    }
    
    return null;
  }
  
  /**
   * Convert Cartesian3 to lat/lon/alt
   */
  function cartesianToLatLonAlt(cartesian) {
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    return {
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      altitude_wgs84: cartographic.height,
    };
  }
  
  /**
   * Get approximate MSL altitude from WGS84 height
   * Note: This is approximate - uses terrain height as proxy for geoid
   */
  async function getAltitudeMSL(latitude, longitude, altitude_wgs84) {
    // Try to sample terrain height for geoid approximation
    try {
      const positions = [Cesium.Cartographic.fromDegrees(longitude, latitude)];
      const terrainProvider = viewer.terrainProvider;
      
      if (terrainProvider && terrainProvider.availability) {
        const sampledPositions = await Cesium.sampleTerrainMostDetailed(terrainProvider, positions);
        const terrainHeight = sampledPositions[0].height || 0;
        
        // Approximate MSL as WGS84 height (geoid undulation is typically -100 to +100m)
        // For more accurate results, Python code uses EGM96 geoid model
        return altitude_wgs84;
      }
    } catch (e) {
      warn(PREFIX, 'Could not sample terrain for MSL conversion:', e);
    }
    
    // Fall back to using WGS84 height as approximation
    return altitude_wgs84;
  }
  
  /**
   * Add a visual marker for a picked point
   */
  function addPointMarker(position, config) {
    const color = config.color || [255, 0, 0, 255];
    const label = config.label || config.point_id || '';
    const pointId = config.point_id || `point_${Date.now()}`;
    
    // Create Cesium Color from RGBA array
    const cesiumColor = new Cesium.Color(
      color[0] / 255,
      color[1] / 255,
      color[2] / 255,
      color[3] / 255
    );
    
    // Add point entity
    const entity = viewer.entities.add({
      id: `picked_point_${pointId}`,
      position: position,
      point: {
        pixelSize: 12,
        color: cesiumColor,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: label,
        font: '12pt sans-serif',
        fillColor: cesiumColor,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(15, 0),
        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    
    pickedPointEntities.push(entity);
    return entity;
  }
  
  /**
   * Remove all picked point markers
   */
  function clearPointMarkers() {
    for (const entity of pickedPointEntities) {
      viewer.entities.remove(entity);
    }
    pickedPointEntities = [];
    log(PREFIX, 'Cleared all point markers');
  }
  
  /**
   * Remove a specific point marker by ID
   */
  function removePointMarker(pointId) {
    const entityId = `picked_point_${pointId}`;
    const entity = viewer.entities.getById(entityId);
    if (entity) {
      viewer.entities.remove(entity);
      pickedPointEntities = pickedPointEntities.filter(e => e.id !== entityId);
      log(PREFIX, `Removed point marker: ${pointId}`);
    }
  }
  
  /**
   * Handle click event for point picking
   */
  async function handleClick(click) {
    if (!isPickingMode) return;
    
    const position = getPositionFromScreen(click.position);
    if (!position) {
      warn(PREFIX, 'Could not determine click position');
      updateStatus('⚠️ Could not pick point at this location. Try clicking on visible terrain or 3D tiles.');
      return;
    }
    
    // Convert to lat/lon/alt
    const coords = cartesianToLatLonAlt(position);
    
    // Get MSL altitude (approximate)
    const altitude_msl = await getAltitudeMSL(coords.latitude, coords.longitude, coords.altitude_wgs84);
    
    // Get current config
    const config = model.get('point_picking_config') || {};
    const currentPoints = model.get('picked_points') || [];
    
    // Auto-increment point ID and label
    const pointNumber = currentPoints.length + 1;
    const labelPrefix = config.label_prefix || 'GCP';
    const pointIdPrefix = config.point_id_prefix || labelPrefix;
    const pointId = `${pointIdPrefix}_${pointNumber}`;
    const label = `${labelPrefix}_${pointNumber}`;
    
    // Add visual marker
    addPointMarker(position, {
      ...config,
      point_id: pointId,
      label: label,
    });
    
    // Create point data
    const pointData = {
      id: pointId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      altitude_wgs84: coords.altitude_wgs84,
      altitude_msl: altitude_msl,
      color: config.color || [255, 0, 0, 255],
      label: label,
      timestamp: new Date().toISOString(),
    };
    
    log(PREFIX, 'Picked point:', pointData);
    
    // Add to picked points list
    model.set('picked_points', [...currentPoints, pointData]);
    model.save_changes();
    
    // Trigger event
    model.set('point_picking_event', pointData);
    model.save_changes();
    
    // Update status
    updateStatus(`✅ Picked ${label} at (${coords.latitude.toFixed(6)}°, ${coords.longitude.toFixed(6)}°, ${altitude_msl.toFixed(1)}m) - Click for next point`);
    
    // Check if continuous mode
    const continuous = config.continuous !== false; // Default to true
    if (!continuous) {
      // Single-point mode: stop after one pick
      isPickingMode = false;
      model.set('point_picking_mode', false);
      model.save_changes();
      setPickingPanelVisible(false);
      log(PREFIX, 'Single-point mode: picking stopped after one point');
    }
  }
  
  /**
   * Start point picking mode
   */
  function startPickingMode() {
    if (handler) {
      handler.destroy();
    }
    
    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(handleClick, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    
    isPickingMode = true;
    setPickingPanelVisible(true);
    
    const config = model.get('point_picking_config') || {};
    const currentPoints = model.get('picked_points') || [];
    const nextNumber = currentPoints.length + 1;
    const labelPrefix = config.label_prefix || 'GCP';
    const continuous = config.continuous !== false;
    
    if (continuous) {
      updateStatus(`🎯 Point Picking Mode (continuous) - Click to pick ${labelPrefix}_${nextNumber}`);
    } else {
      updateStatus(`🎯 Point Picking Mode (single) - Click to pick ${labelPrefix}_${nextNumber}`);
    }
    
    log(PREFIX, 'Started point picking mode', { continuous, labelPrefix });
  }
  
  /**
   * Stop point picking mode
   */
  function stopPickingMode() {
    if (handler) {
      handler.destroy();
      handler = null;
    }
    
    isPickingMode = false;
    setPickingPanelVisible(false);
    
    log(PREFIX, 'Stopped point picking mode');
  }
  
  // Initialize UI
  createPickingPanel();
  
  // Listen for mode changes
  model.on('change:point_picking_mode', () => {
    const enabled = model.get('point_picking_mode');
    if (enabled) {
      startPickingMode();
    } else {
      stopPickingMode();
    }
  });
  
  // Listen for config changes (to update next point's color/label)
  model.on('change:point_picking_config', () => {
    if (isPickingMode) {
      const config = model.get('point_picking_config') || {};
      const currentPoints = model.get('picked_points') || [];
      const nextNumber = currentPoints.length + 1;
      const labelPrefix = config.label_prefix || 'GCP';
      updateStatus(`🎯 Ready to pick ${labelPrefix}_${nextNumber} - Click on scene`);
    }
  });
  
  // Listen for picked_points changes (to sync visuals)
  model.on('change:picked_points', () => {
    const points = model.get('picked_points') || [];
    
    // If points were cleared, remove all markers
    if (points.length === 0 && pickedPointEntities.length > 0) {
      clearPointMarkers();
    }
    
    // Check for removed points
    const currentIds = new Set(pickedPointEntities.map(e => e.id.replace('picked_point_', '')));
    const newIds = new Set(points.map(p => p.id));
    
    for (const id of currentIds) {
      if (!newIds.has(id)) {
        removePointMarker(id);
      }
    }
  });
  
  // Initial state check
  if (model.get('point_picking_mode')) {
    startPickingMode();
  }
  
  // Redraw existing points if any
  const existingPoints = model.get('picked_points') || [];
  for (const point of existingPoints) {
    const cartesian = Cesium.Cartesian3.fromDegrees(
      point.longitude,
      point.latitude,
      point.altitude_wgs84
    );
    addPointMarker(cartesian, {
      point_id: point.id,
      color: point.color,
      label: point.label,
    });
  }
  
  // Return cleanup object
  return {
    destroy: () => {
      stopPickingMode();
      clearPointMarkers();
      if (pickingPanel && pickingPanel.parentNode) {
        pickingPanel.remove();
      }
      log(PREFIX, 'Point picking module destroyed');
    },
  };
}
