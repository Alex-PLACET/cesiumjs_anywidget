"""Integration tests for the CesiumWidget package."""

import pytest
import pathlib


class TestPackageStructure:
    """Test package structure and imports."""
    
    def test_package_imports(self):
        """Test that package can be imported."""
        import cesiumjs_anywidget
        assert cesiumjs_anywidget is not None
    
    def test_widget_import(self):
        """Test that CesiumWidget can be imported."""
        from cesiumjs_anywidget import CesiumWidget
        assert CesiumWidget is not None
    
    def test_package_version(self):
        """Test that package has version."""
        import cesiumjs_anywidget
        assert hasattr(cesiumjs_anywidget, '__version__')
        assert cesiumjs_anywidget.__version__ == "0.1.0"
    
    def test_package_all(self):
        """Test that __all__ is defined."""
        import cesiumjs_anywidget
        assert hasattr(cesiumjs_anywidget, '__all__')
        assert 'CesiumWidget' in cesiumjs_anywidget.__all__


class TestWidgetInheritance:
    """Test widget inheritance and anywidget integration."""
    
    def test_widget_is_anywidget(self, widget_class):
        """Test that CesiumWidget inherits from AnyWidget."""
        import anywidget
        assert issubclass(widget_class, anywidget.AnyWidget)
    
    def test_widget_has_esm(self, widget_instance):
        """Test that widget has _esm attribute."""
        assert hasattr(widget_instance, '_esm')
        assert widget_instance._esm is not None
    
    def test_widget_has_css(self, widget_instance):
        """Test that widget has _css attribute."""
        assert hasattr(widget_instance, '_css')
        assert widget_instance._css is not None


class TestFileIntegrity:
    """Test integrity of widget files."""
    
    def test_javascript_syntax(self, widget_instance):
        """Test that JavaScript file has valid basic syntax."""
        js_content = widget_instance._esm
        
        # Check for basic JavaScript syntax elements
        assert "function render" in js_content or "const render" in js_content
        # Bundled code uses 'export {' format instead of 'export default'
        assert ("export default" in js_content or "export {" in js_content)
        assert "{" in js_content and "}" in js_content
    
    def test_javascript_imports_cesium(self):
        """Test that JavaScript loads Cesium."""
        js_path = pathlib.Path(__file__).parent.parent / "src" / "cesiumjs_anywidget" / "index.js"
        js_content = js_path.read_text()
        # Check that Cesium is loaded (dynamically via loadCesiumJS)
        assert 'Cesium' in js_content
        assert 'loadCesiumJS' in js_content or 'window.Cesium' in js_content
    
    def test_javascript_has_error_handling(self, widget_instance):
        """Test JavaScript has error handling."""
        js_content = widget_instance._esm
        
        assert 'try' in js_content or 'catch' in js_content or 'error' in js_content.lower()
    
    def test_css_file_valid(self, widget_instance):
        """Test that CSS file has valid content."""
        css_content = widget_instance._css
        # Should have some basic CSS
        assert "{" in css_content and "}" in css_content
        # Should not be empty
        assert len(css_content.strip()) > 0


class TestMultipleInstances:
    """Test creating multiple widget instances."""
    
    def test_multiple_instances_independent(self, widget_class):
        """Test that multiple instances are independent."""
        widget1 = widget_class(latitude=10.0)
        widget2 = widget_class(latitude=20.0)
        
        assert widget1.latitude == 10.0
        assert widget2.latitude == 20.0
        
        widget1.latitude = 30.0
        assert widget1.latitude == 30.0
        assert widget2.latitude == 20.0  # Should not change
    
    def test_multiple_instances_different_config(self, widget_class):
        """Test creating multiple instances with different configs."""
        widget1 = widget_class(enable_terrain=True, height="600px")
        widget2 = widget_class(enable_terrain=False, height="800px")
        
        assert widget1.enable_terrain is True
        assert widget2.enable_terrain is False
        assert widget1.height == "600px"
        assert widget2.height == "800px"
    
    def test_ten_instances(self, widget_class):
        """Test creating many instances."""
        widgets = [widget_class(latitude=float(i)) for i in range(10)]
        
        assert len(widgets) == 10
        for i, widget in enumerate(widgets):
            assert widget.latitude == float(i)


class TestEdgeCases:
    """Test edge cases and boundary conditions."""
    
    def test_extreme_altitude_low(self, widget_instance):
        """Test very low altitude."""
        widget_instance.altitude = 0.0
        assert widget_instance.altitude == 0.0
    
    def test_extreme_altitude_high(self, widget_instance):
        """Test very high altitude."""
        widget_instance.altitude = 1000000000.0
        assert widget_instance.altitude == 1000000000.0
    
    def test_height_various_units(self, widget_instance):
        """Test height with various CSS units."""
        widget_instance.height = "500px"
        assert widget_instance.height == "500px"
        
        widget_instance.height = "50%"
        assert widget_instance.height == "50%"
        
        widget_instance.height = "50vh"
        assert widget_instance.height == "50vh"
    
    def test_empty_geojson(self, widget_instance):
        """Test loading empty GeoJSON."""
        geojson = {
            "type": "FeatureCollection",
            "features": []
        }
        widget_instance.load_geojson(geojson)
        assert widget_instance.geojson_data == [geojson]
        assert len(widget_instance.geojson_data[0]["features"]) == 0
    
    def test_ion_token_empty_string(self, widget_instance):
        """Test setting Ion token to empty string."""
        widget_instance.ion_access_token = ""
        assert widget_instance.ion_access_token == ""
    
    def test_ion_token_long_string(self, widget_instance):
        """Test setting Ion token to long string."""
        long_token = "a" * 1000
        widget_instance.ion_access_token = long_token
        assert widget_instance.ion_access_token == long_token


class TestDocumentation:
    """Test that documentation is present."""
    
    def test_widget_has_docstring(self, widget_class):
        """Test that widget class has docstring."""
        assert widget_class.__doc__ is not None
        assert len(widget_class.__doc__) > 0
    
    def test_fly_to_has_docstring(self, widget_class):
        """Test that fly_to method has docstring."""
        assert widget_class.fly_to.__doc__ is not None
    
    def test_set_view_has_docstring(self, widget_class):
        """Test that set_view method has docstring."""
        assert widget_class.set_view.__doc__ is not None
    
    def test_load_geojson_has_docstring(self, widget_class):
        """Test that load_geojson method has docstring."""
        assert widget_class.load_geojson.__doc__ is not None
    
    def test_debug_info_has_docstring(self, widget_class):
        """Test that debug_info method has docstring."""
        assert widget_class.debug_info.__doc__ is not None
