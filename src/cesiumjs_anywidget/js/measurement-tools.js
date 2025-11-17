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
  const Cesium = window.Cesium;
  
  let measurementHandler = null;
  let measurementState = {
    mode: null,
    points: [],
    entities: [],
    labels: [],
    polylines: [],
    polyline: null,
    tempPolyline: null,
  };

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
      results.push({
        type: "distance",
        value: distance,
        points: measurementState.points.map(cartesianToLatLonAlt),
      });
      model.set("measurement_results", results);
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
      if (lastResult && lastResult.type === "multi-distance" && lastResult.isActive) {
        lastResult.value = totalDistance;
        lastResult.points = measurementState.points.map(cartesianToLatLonAlt);
      } else {
        results.push({
          type: "multi-distance",
          value: totalDistance,
          points: measurementState.points.map(cartesianToLatLonAlt),
          isActive: true,
        });
      }
      model.set("measurement_results", results);
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
    results.push({
      type: "height",
      value: height,
      points: [cartesianToLatLonAlt(pickedPosition)],
    });
    model.set("measurement_results", results);
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
      let area = 0;
      const positions = measurementState.points;
      
      for (let i = 0; i < positions.length; i++) {
        const p1 = Cesium.Cartographic.fromCartesian(positions[i]);
        const p2 = Cesium.Cartographic.fromCartesian(positions[(i + 1) % positions.length]);
        
        const x1 = p1.longitude * Cesium.Math.DEGREES_PER_RADIAN;
        const y1 = p1.latitude * Cesium.Math.DEGREES_PER_RADIAN;
        const x2 = p2.longitude * Cesium.Math.DEGREES_PER_RADIAN;
        const y2 = p2.latitude * Cesium.Math.DEGREES_PER_RADIAN;
        
        area += (x1 * y2 - x2 * y1);
      }
      
      area = Math.abs(area / 2);
      const metersPerDegree = 111320;
      area = area * metersPerDegree * metersPerDegree;
      
      let centroidX = 0, centroidY = 0, centroidZ = 0;
      positions.forEach(pos => {
        centroidX += pos.x;
        centroidY += pos.y;
        centroidZ += pos.z;
      });
      const centroid = new Cesium.Cartesian3(
        centroidX / positions.length,
        centroidY / positions.length,
        centroidZ / positions.length
      );
      
      const areaText = area >= 1000000 
        ? `${(area / 1000000).toFixed(2)} km²`
        : `${area.toFixed(2)} m²`;
      
      const oldLabel = measurementState.labels.find(l => l.label && l.label.text._value.includes('m²') || l.label.text._value.includes('km²'));
      if (oldLabel) {
        viewer.entities.remove(oldLabel);
        measurementState.labels = measurementState.labels.filter(l => l !== oldLabel);
      }
      
      addLabel(centroid, areaText);
      
      const results = model.get("measurement_results") || [];
      const lastResult = results[results.length - 1];
      if (lastResult && lastResult.type === "area" && lastResult.isActive) {
        lastResult.value = area;
        lastResult.points = measurementState.points.map(cartesianToLatLonAlt);
      } else {
        results.push({
          type: "area",
          value: area,
          points: measurementState.points.map(cartesianToLatLonAlt),
          isActive: true,
        });
      }
      model.set("measurement_results", results);
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
            delete lastResult.isActive;
            model.set("measurement_results", results);
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
            delete lastResult.isActive;
            model.set("measurement_results", results);
            model.save_changes();
          }
          measurementState.points = [];
        }
      }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    }
  }

  // ============= MODEL LISTENERS =============
  
  model.on("change:measurement_mode", () => {
    const mode = model.get("measurement_mode");
    enableMeasurementMode(mode);
  });

  model.on("change:measurement_results", () => {
    const results = model.get("measurement_results") || [];
    if (results.length === 0) {
      clearAllMeasurements();
    }
  });

  // ============= PUBLIC API =============
  
  return {
    enableMeasurementMode,
    clearAllMeasurements,
    destroy: () => {
      if (measurementHandler) {
        measurementHandler.destroy();
      }
      clearAllMeasurements();
      if (toolbarDiv.parentNode) {
        toolbarDiv.remove();
      }
    }
  };
}
