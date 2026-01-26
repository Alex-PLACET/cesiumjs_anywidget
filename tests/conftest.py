"""Test configuration and fixtures for cesiumjs_anywidget tests."""

import pytest
import pathlib


@pytest.fixture
def widget_class():
    """Import and return the CesiumWidget class."""
    from cesiumjs_anywidget import CesiumWidget
    return CesiumWidget


@pytest.fixture
def widget_instance(widget_class):
    """Create a basic CesiumWidget instance."""
    return widget_class()


@pytest.fixture
def widget_with_config(widget_class):
    """Create a CesiumWidget with custom configuration."""
    return widget_class(
        latitude=40.7128,
        longitude=-74.0060,
        altitude=50000,
        height="800px",
        enable_terrain=False,
        enable_lighting=True,
        show_timeline=True,
        show_animation=True
    )


@pytest.fixture
def sample_geojson():
    """Return sample GeoJSON data for testing."""
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [-74.0060, 40.7128]
                },
                "properties": {
                    "name": "Test Point",
                    "description": "A test point"
                }
            },
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [-74.05, 40.70],
                        [-73.95, 40.70],
                        [-73.95, 40.75],
                        [-74.05, 40.75],
                        [-74.05, 40.70]
                    ]]
                },
                "properties": {
                    "name": "Test Polygon"
                }
            }
        ]
    }


@pytest.fixture
def project_root():
    """Return the project root directory."""
    return pathlib.Path(__file__).parent.parent
