"""Unit tests for CesiumWidget class initialization and configuration."""

import pytest
import pathlib


class TestWidgetInitialization:
    """Test widget initialization and default values."""
    
    def test_widget_creation(self, widget_class):
        """Test that widget can be instantiated."""
        widget = widget_class()
        assert widget is not None
    
    def test_default_camera_position(self, widget_instance):
        """Test default camera position."""
        assert widget_instance.latitude == -122.4175
        assert widget_instance.longitude == 37.655
        assert widget_instance.altitude == 400.0
    
    def test_default_camera_orientation(self, widget_instance):
        """Test default camera orientation."""
        assert widget_instance.heading == 0.0
        assert widget_instance.pitch == -15.0
        assert widget_instance.roll == 0.0
    
    def test_default_viewer_config(self, widget_instance):
        """Test default viewer configuration."""
        assert widget_instance.height == "600px"
        assert widget_instance.enable_terrain is True
        assert widget_instance.enable_lighting is False
        assert widget_instance.show_timeline is True
        assert widget_instance.show_animation is True
    
    def test_default_ion_token(self, widget_instance):
        """Test default Cesium Ion token."""
        assert widget_instance.ion_access_token == ""
    
    def test_default_geojson_data(self, widget_instance):
        """Test default GeoJSON data."""
        assert widget_instance.geojson_data is None


class TestWidgetConfiguration:
    """Test widget configuration with custom values."""
    
    def test_custom_camera_position(self, widget_class):
        """Test widget with custom camera position."""
        widget = widget_class(
            latitude=40.7128,
            longitude=-74.0060,
            altitude=50000
        )
        assert widget.latitude == 40.7128
        assert widget.longitude == -74.0060
        assert widget.altitude == 50000
    
    def test_custom_camera_orientation(self, widget_class):
        """Test widget with custom camera orientation."""
        widget = widget_class(
            heading=45.0,
            pitch=-45.0,
            roll=10.0
        )
        assert widget.heading == 45.0
        assert widget.pitch == -45.0
        assert widget.roll == 10.0
    
    def test_custom_height(self, widget_class):
        """Test widget with custom height."""
        widget = widget_class(height="800px")
        assert widget.height == "800px"
    
    def test_terrain_enabled(self, widget_class):
        """Test widget with terrain enabled."""
        widget = widget_class(enable_terrain=True)
        assert widget.enable_terrain is True
    
    def test_terrain_disabled(self, widget_class):
        """Test widget with terrain disabled."""
        widget = widget_class(enable_terrain=False)
        assert widget.enable_terrain is False
    
    def test_lighting_enabled(self, widget_class):
        """Test widget with lighting enabled."""
        widget = widget_class(enable_lighting=True)
        assert widget.enable_lighting is True
    
    def test_timeline_enabled(self, widget_class):
        """Test widget with timeline enabled."""
        widget = widget_class(show_timeline=True)
        assert widget.show_timeline is True
    
    def test_animation_enabled(self, widget_class):
        """Test widget with animation enabled."""
        widget = widget_class(show_animation=True)
        assert widget.show_animation is True
    
    def test_ion_token_custom(self, widget_class):
        """Test widget with custom Ion token."""
        token = "test_token_12345"
        widget = widget_class(ion_access_token=token)
        assert widget.ion_access_token == token
    
    def test_all_custom_config(self, widget_with_config):
        """Test widget with all custom configuration."""
        assert widget_with_config.latitude == 40.7128
        assert widget_with_config.longitude == -74.0060
        assert widget_with_config.altitude == 50000
        assert widget_with_config.height == "800px"
        assert widget_with_config.enable_terrain is False
        assert widget_with_config.enable_lighting is True
        assert widget_with_config.show_timeline is True
        assert widget_with_config.show_animation is True


class TestWidgetFiles:
    """Test widget file loading and paths."""
    
    def test_esm_file_path(self, widget_instance):
        """Test that _esm points to a valid file."""
        # After anywidget loads, _esm is a string, but we can check the class
        esm_path = pathlib.Path(__file__).parent.parent / "src" / "cesiumjs_anywidget" / "index.js"
        assert esm_path.exists(), f"ESM file not found at {esm_path}"
    
    def test_esm_file_exists(self, widget_instance):
        """Test that the ESM file exists."""
        esm_path = pathlib.Path(__file__).parent.parent / "src" / "cesiumjs_anywidget" / "index.js"
        assert esm_path.exists(), f"ESM file not found at {esm_path}"
    
    def test_esm_file_readable(self, widget_instance):
        """Test that the ESM file can be read."""
        # Check that widget has ESM content (anywidget loads it as string)
        assert isinstance(widget_instance._esm, str)
        assert len(widget_instance._esm) > 0
        assert "render" in widget_instance._esm
    
    def test_css_file_path(self, widget_instance):
        """Test that _css points to a valid file."""
        css_path = pathlib.Path(__file__).parent.parent / "src" / "cesiumjs_anywidget" / "styles.css"
        assert css_path.exists(), f"CSS file not found at {css_path}"
    
    def test_css_file_exists(self, widget_instance):
        """Test that the CSS file exists."""
        css_path = pathlib.Path(__file__).parent.parent / "src" / "cesiumjs_anywidget" / "styles.css"
        assert css_path.exists(), f"CSS file not found at {css_path}"
    
    def test_css_file_readable(self, widget_instance):
        """Test that the CSS file can be read."""
        # Check that widget has CSS content (anywidget loads it as string)
        assert isinstance(widget_instance._css, str)
        assert len(widget_instance._css) > 0


class TestTraitlets:
    """Test that traitlets are properly configured."""
    
    def test_latitude_is_float(self, widget_instance):
        """Test that latitude trait accepts floats."""
        widget_instance.latitude = 45.5
        assert widget_instance.latitude == 45.5
    
    def test_longitude_is_float(self, widget_instance):
        """Test that longitude trait accepts floats."""
        widget_instance.longitude = -120.3
        assert widget_instance.longitude == -120.3
    
    def test_altitude_is_float(self, widget_instance):
        """Test that altitude trait accepts floats."""
        widget_instance.altitude = 10000.5
        assert widget_instance.altitude == 10000.5
    
    def test_heading_is_float(self, widget_instance):
        """Test that heading trait accepts floats."""
        widget_instance.heading = 90.0
        assert widget_instance.heading == 90.0
    
    def test_pitch_is_float(self, widget_instance):
        """Test that pitch trait accepts floats."""
        widget_instance.pitch = -45.0
        assert widget_instance.pitch == -45.0
    
    def test_roll_is_float(self, widget_instance):
        """Test that roll trait accepts floats."""
        widget_instance.roll = 5.0
        assert widget_instance.roll == 5.0
    
    def test_height_is_string(self, widget_instance):
        """Test that height trait accepts strings."""
        widget_instance.height = "500px"
        assert widget_instance.height == "500px"
    
    def test_enable_terrain_is_bool(self, widget_instance):
        """Test that enable_terrain trait accepts booleans."""
        widget_instance.enable_terrain = False
        assert widget_instance.enable_terrain is False
    
    def test_enable_lighting_is_bool(self, widget_instance):
        """Test that enable_lighting trait accepts booleans."""
        widget_instance.enable_lighting = True
        assert widget_instance.enable_lighting is True
    
    def test_show_timeline_is_bool(self, widget_instance):
        """Test that show_timeline trait accepts booleans."""
        widget_instance.show_timeline = True
        assert widget_instance.show_timeline is True
    
    def test_show_animation_is_bool(self, widget_instance):
        """Test that show_animation trait accepts booleans."""
        widget_instance.show_animation = True
        assert widget_instance.show_animation is True
