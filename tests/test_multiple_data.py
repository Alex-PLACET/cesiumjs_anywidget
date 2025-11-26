#!/usr/bin/env python
"""Test script to verify multiple GeoJSON/CZML loading and clearing"""

from cesiumjs_anywidget import CesiumWidget

# Create widget
w = CesiumWidget()

print("Testing multiple GeoJSON and CZML loading:")
print("=" * 60)

# Test GeoJSON
geojson1 = {
    "type": "FeatureCollection",
    "features": [{
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [2.3522, 48.8566]},
        "properties": {"name": "Point 1"}
    }]
}

geojson2 = {
    "type": "FeatureCollection",
    "features": [{
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [-74.0060, 40.7128]},
        "properties": {"name": "Point 2"}
    }]
}

print("\n1. Loading first GeoJSON...")
w.load_geojson(geojson1)
print(f"   GeoJSON data count: {len(w.geojson_data)}")
assert len(w.geojson_data) == 1, "Should have 1 GeoJSON dataset"

print("\n2. Loading second GeoJSON (appending)...")
w.load_geojson(geojson2)
print(f"   GeoJSON data count: {len(w.geojson_data)}")
assert len(w.geojson_data) == 2, "Should have 2 GeoJSON datasets"

print("\n3. Clearing GeoJSON...")
w.clear_geojson()
print(f"   GeoJSON data count: {len(w.geojson_data)}")
assert len(w.geojson_data) == 0, "Should have 0 GeoJSON datasets"

print("\n4. Loading GeoJSON with clear_existing=True...")
w.load_geojson(geojson1)
w.load_geojson(geojson2)
print(f"   Before: {len(w.geojson_data)} datasets")
w.load_geojson(geojson1, clear_existing=True)
print(f"   After clear_existing: {len(w.geojson_data)} datasets")
assert len(w.geojson_data) == 1, "Should have 1 GeoJSON dataset"

# Test CZML
czml1 = [
    {"id": "document", "version": "1.0"},
    {"id": "point1", "position": {"cartographicDegrees": [-74, 40, 0]}}
]

czml2 = [
    {"id": "document", "version": "1.0"},
    {"id": "point2", "position": {"cartographicDegrees": [2, 48, 0]}}
]

print("\n5. Loading first CZML...")
w.clear_czml()
w.load_czml(czml1)
print(f"   CZML data count: {len(w.czml_data)}")
assert len(w.czml_data) == 1, "Should have 1 CZML document"

print("\n6. Loading second CZML (appending)...")
w.load_czml(czml2)
print(f"   CZML data count: {len(w.czml_data)}")
assert len(w.czml_data) == 2, "Should have 2 CZML documents"

print("\n7. Clearing CZML...")
w.clear_czml()
print(f"   CZML data count: {len(w.czml_data)}")
assert len(w.czml_data) == 0, "Should have 0 CZML documents"

print("\n8. Loading CZML with clear_existing=True...")
w.load_czml(czml1)
w.load_czml(czml2)
print(f"   Before: {len(w.czml_data)} documents")
w.load_czml(czml1, clear_existing=True)
print(f"   After clear_existing: {len(w.czml_data)} documents")
assert len(w.czml_data) == 1, "Should have 1 CZML document"

print("\n" + "=" * 60)
print("✅ All tests passed!")
print("=" * 60)
print("\nNew capabilities:")
print("  • load_geojson() - Load multiple GeoJSON datasets")
print("  • clear_geojson() - Clear all GeoJSON data")
print("  • load_czml() - Load multiple CZML documents")
print("  • clear_czml() - Clear all CZML data")
print("  • clear_existing parameter - Replace instead of append")
