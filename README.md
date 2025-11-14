# CesiumJS Anywidget

A Jupyter widget for interactive 3D globe visualization using [CesiumJS](https://cesium.com/cesiumjs/) and [anywidget](https://anywidget.dev/).

## Features

- 🌍 Interactive 3D globe with CesiumJS
- 🎯 Camera position control from Python
- 🔄 Bidirectional state synchronization
- 📍 GeoJSON data visualization
- 🏔️ Terrain and imagery layers
- ⚡ Hot module replacement for development

## Installation

Using uv (recommended):

```bash
uv pip install cesiumjs-anywidget
```

Or for development:

```bash
git clone https://github.com/Alex-PLACET/cesiumjs_anywidget.git
cd cesiumjs_anywidget
uv pip install -e ".[dev]"
```

## Quick Start

```python
from cesiumjs_anywidget import CesiumWidget

# Create and display the widget
widget = CesiumWidget(height="700px")
widget
```

## Usage Examples

### Fly to a Location

```python
# Fly to New York City
widget.fly_to(latitude=40.7128, longitude=-74.0060, altitude=50000)

# Fly to Mount Everest
widget.fly_to(latitude=27.9881, longitude=86.9250, altitude=20000)
```

### Advanced Camera Control

```python
# Set camera with custom orientation
widget.set_view(
    latitude=40.7128, 
    longitude=-74.0060, 
    altitude=5000,
    heading=45.0,    # Rotate view 45 degrees
    pitch=-45.0,     # Look at angle instead of straight down
    roll=0.0
)
```

### Read Camera State

```python
# Camera position is synchronized bidirectionally
print(f"Latitude: {widget.latitude:.4f}°")
print(f"Longitude: {widget.longitude:.4f}°")
print(f"Altitude: {widget.altitude:.2f} meters")
```

### Visualize GeoJSON Data

```python
geojson_data = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [-74.0060, 40.7128]
            },
            "properties": {
                "name": "New York City"
            }
        }
    ]
}

widget.load_geojson(geojson_data)
```

### Configure Viewer Options

```python
# Create widget with custom configuration
widget = CesiumWidget(
    height="700px",
    enable_terrain=True,
    enable_lighting=True,
    show_timeline=True,
    show_animation=True,
    latitude=27.9881,
    longitude=86.9250,
    altitude=30000
)
```

## Development

Enable hot module replacement for live updates during development:

```bash
export ANYWIDGET_HMR=1
jupyter lab
```

### Running Tests

```bash
# Install with dev dependencies
uv pip install -e ".[dev]"

# Run all tests
pytest

# Run with coverage
pytest --cov=cesiumjs_anywidget --cov-report=html

# Or use make
make test
make test-cov
```

See [tests/README.md](tests/README.md) for detailed testing documentation.

## API Reference

### CesiumWidget

**Parameters:**
- `latitude` (float): Camera latitude in degrees (default: 0.0)
- `longitude` (float): Camera longitude in degrees (default: 0.0)
- `altitude` (float): Camera altitude in meters (default: 20000000.0)
- `heading` (float): Camera heading in degrees (default: 0.0)
- `pitch` (float): Camera pitch in degrees (default: -90.0)
- `roll` (float): Camera roll in degrees (default: 0.0)
- `height` (str): Widget height CSS value (default: "600px")
- `enable_terrain` (bool): Enable terrain visualization (default: True)
- `enable_lighting` (bool): Enable scene lighting (default: False)
- `show_timeline` (bool): Show timeline widget (default: False)
- `show_animation` (bool): Show animation widget (default: False)
- `ion_access_token` (str): Cesium Ion access token (optional)
- `geojson_data` (dict): GeoJSON data to display (optional)

**Methods:**
- `fly_to(latitude, longitude, altitude=10000, duration=3.0)`: Fly camera to location
- `set_view(latitude, longitude, altitude=10000, heading=0.0, pitch=-90.0, roll=0.0)`: Set camera view instantly
- `load_geojson(geojson)`: Load GeoJSON data for visualization

## Examples

See the [examples](examples/) directory for Jupyter notebook demonstrations.

## Troubleshooting

If you encounter issues with widget initialization:

```python
from cesiumjs_anywidget import CesiumWidget
widget = CesiumWidget()
widget.debug_info()  # Show debug information
```

Common fixes:
- **Open browser DevTools (F12)** and check the Console tab for errors
- Try without terrain: `widget = CesiumWidget(enable_terrain=False)`
- Ensure you're using JupyterLab 4.0+ or Jupyter Notebook 7.0+
- Check internet connection (CesiumJS loads from CDN)

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed debugging guide.

## License

Apache License 2.0 - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [anywidget](https://anywidget.dev/)
- Powered by [CesiumJS](https://cesium.com/cesiumjs/)
- Uses [Cesium Ion](https://cesium.com/ion/) for terrain and imagery