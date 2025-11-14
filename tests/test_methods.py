"""Tests for widget methods (fly_to, set_view, load_geojson)."""

import pytest
import json


class TestFlyToMethod:
    """Test the fly_to method."""
    
    def test_fly_to_basic(self, widget_instance):
        """Test basic fly_to functionality."""
        widget_instance.fly_to(40.7128, -74.0060, 50000)
        assert widget_instance.latitude == 40.7128
        assert widget_instance.longitude == -74.0060
        assert widget_instance.altitude == 50000
    
    def test_fly_to_default_altitude(self, widget_instance):
        """Test fly_to with default altitude."""
        widget_instance.fly_to(48.8566, 2.3522)
        assert widget_instance.latitude == 48.8566
        assert widget_instance.longitude == 2.3522
        assert widget_instance.altitude == 10000  # default
    
    def test_fly_to_negative_coordinates(self, widget_instance):
        """Test fly_to with negative coordinates."""
        widget_instance.fly_to(-33.8688, 151.2093, 25000)
        assert widget_instance.latitude == -33.8688
        assert widget_instance.longitude == 151.2093
        assert widget_instance.altitude == 25000
    
    def test_fly_to_zero_coordinates(self, widget_instance):
        """Test fly_to with zero coordinates."""
        widget_instance.fly_to(0.0, 0.0, 100000)
        assert widget_instance.latitude == 0.0
        assert widget_instance.longitude == 0.0
        assert widget_instance.altitude == 100000
    
    def test_fly_to_extreme_latitude(self, widget_instance):
        """Test fly_to with extreme latitude values."""
        widget_instance.fly_to(89.9, 0.0, 50000)
        assert widget_instance.latitude == 89.9
        
        widget_instance.fly_to(-89.9, 0.0, 50000)
        assert widget_instance.latitude == -89.9
    
    def test_fly_to_extreme_longitude(self, widget_instance):
        """Test fly_to with extreme longitude values."""
        widget_instance.fly_to(0.0, 179.9, 50000)
        assert widget_instance.longitude == 179.9
        
        widget_instance.fly_to(0.0, -179.9, 50000)
        assert widget_instance.longitude == -179.9


class TestSetViewMethod:
    """Test the set_view method."""
    
    def test_set_view_basic(self, widget_instance):
        """Test basic set_view functionality."""
        widget_instance.set_view(40.7128, -74.0060)
        assert widget_instance.latitude == 40.7128
        assert widget_instance.longitude == -74.0060
        assert widget_instance.altitude == 10000  # default
        assert widget_instance.heading == 0.0  # default
        assert widget_instance.pitch == -90.0  # default
        assert widget_instance.roll == 0.0  # default
    
    def test_set_view_with_altitude(self, widget_instance):
        """Test set_view with custom altitude."""
        widget_instance.set_view(48.8566, 2.3522, altitude=25000)
        assert widget_instance.latitude == 48.8566
        assert widget_instance.longitude == 2.3522
        assert widget_instance.altitude == 25000
    
    def test_set_view_with_orientation(self, widget_instance):
        """Test set_view with custom orientation."""
        widget_instance.set_view(
            40.7128, -74.0060,
            altitude=5000,
            heading=45.0,
            pitch=-45.0,
            roll=10.0
        )
        assert widget_instance.latitude == 40.7128
        assert widget_instance.longitude == -74.0060
        assert widget_instance.altitude == 5000
        assert widget_instance.heading == 45.0
        assert widget_instance.pitch == -45.0
        assert widget_instance.roll == 10.0
    
    def test_set_view_full_rotation(self, widget_instance):
        """Test set_view with full rotation values."""
        widget_instance.set_view(
            0.0, 0.0,
            heading=360.0,
            pitch=-90.0,
            roll=0.0
        )
        assert widget_instance.heading == 360.0
        assert widget_instance.pitch == -90.0
        assert widget_instance.roll == 0.0
    
    def test_set_view_overwrites_previous(self, widget_instance):
        """Test that set_view overwrites previous values."""
        widget_instance.set_view(10.0, 20.0, heading=90.0)
        widget_instance.set_view(30.0, 40.0, heading=180.0)
        
        assert widget_instance.latitude == 30.0
        assert widget_instance.longitude == 40.0
        assert widget_instance.heading == 180.0


class TestLoadGeoJSONMethod:
    """Test the load_geojson method."""
    
    def test_load_geojson_dict(self, widget_instance, sample_geojson):
        """Test loading GeoJSON from dictionary."""
        widget_instance.load_geojson(sample_geojson)
        assert widget_instance.geojson_data is not None
        assert widget_instance.geojson_data == sample_geojson
    
    def test_load_geojson_string(self, widget_instance, sample_geojson):
        """Test loading GeoJSON from JSON string."""
        geojson_string = json.dumps(sample_geojson)
        widget_instance.load_geojson(geojson_string)
        assert widget_instance.geojson_data is not None
        assert widget_instance.geojson_data == sample_geojson
    
    def test_load_geojson_point(self, widget_instance):
        """Test loading single point GeoJSON."""
        geojson = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [-74.0060, 40.7128]
            },
            "properties": {"name": "Test"}
        }
        widget_instance.load_geojson(geojson)
        assert widget_instance.geojson_data == geojson
    
    def test_load_geojson_polygon(self, widget_instance):
        """Test loading polygon GeoJSON."""
        geojson = {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [0, 0], [1, 0], [1, 1], [0, 1], [0, 0]
                ]]
            }
        }
        widget_instance.load_geojson(geojson)
        assert widget_instance.geojson_data == geojson
    
    def test_load_geojson_linestring(self, widget_instance):
        """Test loading LineString GeoJSON."""
        geojson = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[0, 0], [1, 1], [2, 2]]
            }
        }
        widget_instance.load_geojson(geojson)
        assert widget_instance.geojson_data == geojson
    
    def test_load_geojson_feature_collection(self, widget_instance):
        """Test loading FeatureCollection GeoJSON."""
        geojson = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [0, 0]}
                },
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [1, 1]}
                }
            ]
        }
        widget_instance.load_geojson(geojson)
        assert widget_instance.geojson_data == geojson
        assert len(widget_instance.geojson_data["features"]) == 2
    
    def test_load_geojson_overwrites(self, widget_instance, sample_geojson):
        """Test that loading new GeoJSON overwrites previous data."""
        widget_instance.load_geojson(sample_geojson)
        
        new_geojson = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [0, 0]}
        }
        widget_instance.load_geojson(new_geojson)
        
        assert widget_instance.geojson_data == new_geojson
        assert widget_instance.geojson_data != sample_geojson


class TestWidgetState:
    """Test widget state management."""
    
    def test_state_persistence(self, widget_instance):
        """Test that widget state persists across changes."""
        widget_instance.latitude = 10.0
        widget_instance.longitude = 20.0
        
        assert widget_instance.latitude == 10.0
        assert widget_instance.longitude == 20.0
    
    def test_multiple_property_changes(self, widget_instance):
        """Test changing multiple properties."""
        widget_instance.latitude = 40.7128
        widget_instance.longitude = -74.0060
        widget_instance.altitude = 50000
        widget_instance.height = "700px"
        widget_instance.enable_terrain = False
        
        assert widget_instance.latitude == 40.7128
        assert widget_instance.longitude == -74.0060
        assert widget_instance.altitude == 50000
        assert widget_instance.height == "700px"
        assert widget_instance.enable_terrain is False
    
    def test_toggle_boolean_properties(self, widget_instance):
        """Test toggling boolean properties."""
        original_terrain = widget_instance.enable_terrain
        widget_instance.enable_terrain = not original_terrain
        assert widget_instance.enable_terrain != original_terrain
        
        original_lighting = widget_instance.enable_lighting
        widget_instance.enable_lighting = not original_lighting
        assert widget_instance.enable_lighting != original_lighting


class TestDebugMethod:
    """Test the debug_info method."""
    
    def test_debug_info_runs(self, widget_instance, capsys):
        """Test that debug_info method runs without errors."""
        # Temporarily redirect to avoid file path issues
        import io
        import sys
        old_stdout = sys.stdout
        sys.stdout = io.StringIO()
        try:
            widget_instance.debug_info()
            output = sys.stdout.getvalue()
            assert "CesiumWidget Debug Info" in output
        finally:
            sys.stdout = old_stdout
    
    def test_debug_info_shows_paths(self, widget_instance):
        """Test that debug_info shows file paths."""
        import io
        import sys
        old_stdout = sys.stdout
        sys.stdout = io.StringIO()
        try:
            widget_instance.debug_info()
            output = sys.stdout.getvalue()
            assert "JavaScript file:" in output
            assert "CSS file:" in output
            assert "Path:" in output
            assert "Exists:" in output
        finally:
            sys.stdout = old_stdout
    
    def test_debug_info_shows_state(self, widget_instance, capsys):
        """Test that debug_info shows widget state."""
        import io
        import sys
        old_stdout = sys.stdout
        sys.stdout = io.StringIO()
        try:
            widget_instance.debug_info()
            output = sys.stdout.getvalue()
            assert "Current state:" in output
            assert "Position:" in output
            assert "Altitude:" in output
        finally:
            sys.stdout = old_stdout
    
    def test_debug_info_shows_tips(self, widget_instance, capsys):
        """Test that debug_info shows debugging tips."""
        widget_instance.debug_info()
        captured = capsys.readouterr()
        assert "Debugging tips:" in captured.out
        assert "DevTools" in captured.out or "Console" in captured.out
