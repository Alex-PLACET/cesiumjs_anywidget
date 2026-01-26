"""Tests for measurement tools functionality."""

import pytest
from cesiumjs_anywidget import CesiumWidget


class TestMeasurementTools:
    """Test measurement tools functionality."""
    
    def test_measurement_mode_default(self):
        """Test that measurement_mode is empty by default."""
        widget = CesiumWidget()
        assert widget.measurement_mode == ""
    
    def test_measurement_results_default(self):
        """Test that measurement_results is empty by default."""
        widget = CesiumWidget()
        assert widget.measurement_results == []
    
    def test_enable_distance_measurement(self):
        """Test enabling distance measurement mode."""
        widget = CesiumWidget()
        widget.enable_measurement(mode="distance")
        assert widget.measurement_mode == "distance"
    
    def test_enable_multi_distance_measurement(self):
        """Test enabling multi-distance measurement mode."""
        widget = CesiumWidget()
        widget.enable_measurement(mode="multi-distance")
        assert widget.measurement_mode == "multi-distance"
    
    def test_enable_height_measurement(self):
        """Test enabling height measurement mode."""
        widget = CesiumWidget()
        widget.enable_measurement(mode="height")
        assert widget.measurement_mode == "height"
    
    def test_enable_measurement_invalid_mode(self):
        """Test that invalid mode raises ValueError."""
        widget = CesiumWidget()
        with pytest.raises(ValueError, match="Invalid mode"):
            widget.enable_measurement(mode="invalid")
    
    def test_disable_measurement(self):
        """Test disabling measurement mode."""
        widget = CesiumWidget()
        widget.enable_measurement(mode="distance")
        widget.disable_measurement()
        assert widget.measurement_mode == ""
        assert widget.measurement_results == []
    
    def test_clear_measurements(self):
        """Test clearing measurements."""
        widget = CesiumWidget()
        # Simulate some measurements
        widget.measurement_results = [
            {"type": "distance", "value": 100.0, "points": []},
            {"type": "height", "value": 50.0, "points": []},
        ]
        widget.clear_measurements()
        assert widget.measurement_results == []
    
    def test_get_measurements_empty(self):
        """Test getting measurements when none exist."""
        widget = CesiumWidget()
        measurements = widget.get_measurements()
        assert measurements == []
    
    def test_get_measurements_with_data(self):
        """Test getting measurements with data."""
        widget = CesiumWidget()
        test_measurements = [
            {
                "type": "distance",
                "value": 150.5,
                "points": [
                    {"lat": 40.0, "lon": -74.0, "alt": 10.0},
                    {"lat": 40.001, "lon": -74.001, "alt": 20.0},
                ],
            },
            {
                "type": "height",
                "value": 45.2,
                "points": [{"lat": 40.0, "lon": -74.0, "alt": 50.0}],
            },
        ]
        widget.measurement_results = test_measurements
        measurements = widget.get_measurements()
        assert len(measurements) == 2
        assert measurements[0]["type"] == "distance"
        assert measurements[0]["value"] == 150.5
        assert measurements[1]["type"] == "height"
        assert measurements[1]["value"] == 45.2


class TestMeasurementTraitlets:
    """Test measurement traitlets."""
    
    def test_measurement_mode_is_unicode(self):
        """Test that measurement_mode is a Unicode traitlet."""
        widget = CesiumWidget()
        assert hasattr(widget, 'measurement_mode')
        widget.measurement_mode = "distance"
        assert widget.measurement_mode == "distance"
    
    def test_measurement_results_is_list(self):
        """Test that measurement_results is a List traitlet."""
        widget = CesiumWidget()
        assert hasattr(widget, 'measurement_results')
        assert isinstance(widget.measurement_results, list)
        
        # Test assignment
        test_data = [{"type": "distance", "value": 100.0, "points": []}]
        widget.measurement_results = test_data
        assert widget.measurement_results == test_data
    
    def test_measurement_results_accepts_dicts(self):
        """Test that measurement_results accepts list of dicts."""
        widget = CesiumWidget()
        measurements = [
            {"type": "distance", "value": 123.45},
            {"type": "height", "value": 67.89},
        ]
        widget.measurement_results = measurements
        assert len(widget.measurement_results) == 2
        assert widget.measurement_results[0]["value"] == 123.45


class TestMeasurementIntegration:
    """Test measurement integration scenarios."""
    
    def test_measurement_workflow_distance(self):
        """Test complete distance measurement workflow."""
        widget = CesiumWidget()
        
        # Enable distance mode
        widget.enable_measurement(mode="distance")
        assert widget.measurement_mode == "distance"
        
        # Simulate measurement result (normally from JavaScript)
        widget.measurement_results = [
            {
                "type": "distance",
                "value": 250.75,
                "points": [
                    {"lat": 40.7128, "lon": -74.0060, "alt": 0},
                    {"lat": 40.7589, "lon": -73.9851, "alt": 0},
                ],
            }
        ]
        
        # Get measurements
        measurements = widget.get_measurements()
        assert len(measurements) == 1
        assert measurements[0]["type"] == "distance"
        assert measurements[0]["value"] == 250.75
        
        # Disable and verify clear
        widget.disable_measurement()
        assert widget.measurement_mode == ""
        assert widget.measurement_results == []
    
    def test_measurement_workflow_height(self):
        """Test complete height measurement workflow."""
        widget = CesiumWidget()
        
        # Enable height mode
        widget.enable_measurement(mode="height")
        assert widget.measurement_mode == "height"
        
        # Simulate measurement result
        widget.measurement_results = [
            {
                "type": "height",
                "value": 85.3,
                "points": [{"lat": 40.7589, "lon": -73.9851, "alt": 85.3}],
            }
        ]
        
        # Verify
        measurements = widget.get_measurements()
        assert len(measurements) == 1
        assert measurements[0]["type"] == "height"
        assert abs(measurements[0]["value"] - 85.3) < 0.01
    
    def test_multiple_measurements(self):
        """Test multiple measurements accumulation."""
        widget = CesiumWidget()
        
        # Add multiple measurements
        widget.measurement_results = [
            {"type": "distance", "value": 100.0, "points": []},
            {"type": "distance", "value": 200.0, "points": []},
            {"type": "height", "value": 50.0, "points": []},
        ]
        
        measurements = widget.get_measurements()
        assert len(measurements) == 3
        
        # Clear
        widget.clear_measurements()
        assert len(widget.get_measurements()) == 0
    
    def test_measurement_mode_switching(self):
        """Test switching between measurement modes."""
        widget = CesiumWidget()
        
        # Switch between modes
        widget.enable_measurement(mode="distance")
        assert widget.measurement_mode == "distance"
        
        widget.enable_measurement(mode="height")
        assert widget.measurement_mode == "height"
        
        widget.enable_measurement(mode="multi-distance")
        assert widget.measurement_mode == "multi-distance"
        
        widget.disable_measurement()
        assert widget.measurement_mode == ""
