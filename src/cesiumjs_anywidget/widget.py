"""CesiumJS widget implementation using anywidget."""

import os
import pathlib
import anywidget
import traitlets


class CesiumWidget(anywidget.AnyWidget):
    """A Jupyter widget for CesiumJS 3D globe visualization.
    
    This widget provides an interactive 3D globe with support for:
    - Camera position control (latitude, longitude, altitude)
    - Terrain and imagery visualization
    - Entity management (markers, shapes, models)
    - Bidirectional state synchronization between Python and JavaScript
    
    Examples
    --------
    Basic usage:
    >>> from cesiumjs_anywidget import CesiumWidget
    >>> widget = CesiumWidget()
    >>> widget  # Display in Jupyter
    
    Fly to a location:
    >>> widget.latitude = 40.7128
    >>> widget.longitude = -74.0060
    >>> widget.altitude = 10000
    
    Debugging:
    >>> widget.debug_info()  # Show debug information
    """
    
    # Load JavaScript and CSS from files
    _esm = pathlib.Path(__file__).parent / "index.js"
    _css = pathlib.Path(__file__).parent / "styles.css"
    
    # Camera position properties (synced with JavaScript)
    latitude = traitlets.Float(-122.4175, help="Camera latitude in degrees").tag(sync=True)
    longitude = traitlets.Float(37.655, help="Camera longitude in degrees").tag(sync=True)
    altitude = traitlets.Float(400.0, help="Camera altitude in meters").tag(sync=True)
    
    # Camera orientation
    heading = traitlets.Float(0.0, help="Camera heading in degrees").tag(sync=True)
    pitch = traitlets.Float(-15.0, help="Camera pitch in degrees").tag(sync=True)
    roll = traitlets.Float(0.0, help="Camera roll in degrees").tag(sync=True)
    
    # Viewer configuration
    height = traitlets.Unicode("600px", help="Widget height").tag(sync=True)
    
    # Viewer options
    enable_terrain = traitlets.Bool(True, help="Enable terrain visualization").tag(sync=True)
    enable_lighting = traitlets.Bool(False, help="Enable scene lighting").tag(sync=True)
    show_timeline = traitlets.Bool(False, help="Show timeline widget").tag(sync=True)
    show_animation = traitlets.Bool(False, help="Show animation widget").tag(sync=True)
    
    # Cesium Ion access token (optional, uses default if not set)
    ion_access_token = traitlets.Unicode("", help="Cesium Ion access token").tag(sync=True)
    
    # GeoJSON data for visualization
    geojson_data = traitlets.Dict(default_value=None, allow_none=True, 
                                   help="GeoJSON data to display").tag(sync=True)
    
    # Measurement tools
    measurement_mode = traitlets.Unicode("", help="Active measurement mode: 'distance', 'multi-distance', 'height', or '' for none").tag(sync=True)
    measurement_results = traitlets.List(trait=traitlets.Dict(), default_value=[], 
                                         help="List of measurement results").tag(sync=True)
    load_measurements_trigger = traitlets.Dict(default_value={}, help="Trigger to load measurements with visual display").tag(sync=True)
    focus_measurement_trigger = traitlets.Dict(default_value={}, help="Trigger to focus on a specific measurement").tag(sync=True)
    
    def __init__(self, **kwargs):
        """Initialize the CesiumWidget.
        
        Automatically checks for CESIUM_ION_TOKEN environment variable if no token is provided.
        """
        # Check for token in environment variable if not provided
        if 'ion_access_token' not in kwargs or not kwargs['ion_access_token']:
            env_token = os.environ.get('CESIUM_ION_TOKEN', '')
            if env_token:
                kwargs['ion_access_token'] = env_token
            else:
                print("⚠️  No Cesium Ion access token provided.")
                print("   Your access token can be found at: https://ion.cesium.com/tokens")
                print("   You can set it via:")
                print("   - CesiumWidget(ion_access_token='your_token')")
                print("   - export CESIUM_ION_TOKEN='your_token'  # in your shell")
                print("   Note: Some features may not work without a token.")
        
        super().__init__(**kwargs)
    
    def fly_to(self, latitude, longitude, altitude=400, duration=3.0):
        """Fly the camera to a specific location.
        
        Parameters
        ----------
        latitude : float
            Target latitude in degrees
        longitude : float
            Target longitude in degrees
        altitude : float, optional
            Target altitude in meters (default: 400)
        duration : float, optional
            Flight duration in seconds (default: 3.0)
        """
        self.latitude = latitude
        self.longitude = longitude
        self.altitude = altitude
    
    def set_view(self, latitude, longitude, altitude=400, heading=0.0, pitch=-15.0, roll=0.0):
        """Set the camera view instantly without animation.
        
        Parameters
        ----------
        latitude : float
            Camera latitude in degrees
        longitude : float
            Camera longitude in degrees
        altitude : float, optional
            Camera altitude in meters (default: 400)
        heading : float, optional
            Camera heading in degrees (default: 0.0)
        pitch : float, optional
            Camera pitch in degrees (default: -15.0)
        roll : float, optional
            Camera roll in degrees (default: 0.0)
        """
        self.latitude = latitude
        self.longitude = longitude
        self.altitude = altitude
        self.heading = heading
        self.pitch = pitch
        self.roll = roll
    
    def load_geojson(self, geojson):
        """Load GeoJSON data for visualization.
        
        Parameters
        ----------
        geojson : dict
            GeoJSON dictionary or GeoJSON object
        """
        if isinstance(geojson, str):
            import json
            geojson = json.loads(geojson)
        self.geojson_data = geojson
    
    def enable_measurement(self, mode="distance"):
        """Enable a measurement tool.
        
        Parameters
        ----------
        mode : str, optional
            Measurement mode to enable:
            - 'distance': Two-point distance measurement
            - 'multi-distance': Multi-point polyline measurement
            - 'height': Vertical height measurement from ground
            - 'area': Polygon area measurement
            Default: 'distance'
        """
        valid_modes = ['distance', 'multi-distance', 'height', 'area']
        if mode not in valid_modes:
            raise ValueError(f"Invalid mode '{mode}'. Must be one of {valid_modes}")
        self.measurement_mode = mode
    
    def disable_measurement(self):
        """Disable the active measurement tool and clear measurements."""
        self.measurement_mode = ""
        self.measurement_results = []
    
    def get_measurements(self):
        """Get all measurement results.
        
        Returns
        -------
        list of dict
            List of measurement results, each containing:
            - type: measurement type ('distance', 'multi-distance', 'height', or 'area')
            - value: measured value in meters (or square meters for area)
            - points: list of {lat, lon, alt} coordinates
        """
        return self.measurement_results
    
    def clear_measurements(self):
        """Clear all measurements from the viewer."""
        self.measurement_results = []
    
    def load_measurements(self, measurements):
        """Load and display measurements on the map.
        
        Parameters
        ----------
        measurements : list of dict
            List of measurements to load and display. Each measurement should contain:
            - type: str - 'distance', 'multi-distance', 'height', or 'area'
            - points: list of [lon, lat, alt] coordinates (GeoJSON style)
            
        Examples
        --------
        >>> widget.load_measurements([
        ...     {
        ...         "type": "distance",
        ...         "points": [[2.3522, 48.8566, 100], [2.3550, 48.8600, 105]]
        ...     },
        ...     {
        ...         "type": "area",
        ...         "points": [[2.3522, 48.8566, 100], [2.3550, 48.8600, 105], [2.3500, 48.8620, 98]]
        ...     }
        ... ])
        """
        import time
        # Send measurements with a timestamp to trigger the change detection
        self.load_measurements_trigger = {
            "measurements": measurements,
            "timestamp": time.time()
        }
    
    def focus_on_measurement(self, index):
        """Focus the camera on a specific measurement by index.
        
        Parameters
        ----------
        index : int
            The index of the measurement to focus on (0-based)
        
        Examples
        --------
        >>> widget.focus_on_measurement(0)  # Focus on first measurement
        >>> widget.focus_on_measurement(2)  # Focus on third measurement
        """
        import time
        self.focus_measurement_trigger = {
            "index": index,
            "timestamp": time.time()
        }
    
    def debug_info(self):
        """Print debug information about the widget.
        
        This is useful for troubleshooting widget initialization issues.
        """
        print("=== CesiumWidget Debug Info ===")
        print(f"Widget class: {self.__class__.__name__}")
        print(f"Anywidget version: {anywidget.__version__}")
        
        # Check file paths (note: after widget instantiation, _esm and _css contain file contents)
        esm_path = pathlib.Path(__file__).parent / "index.js"
        css_path = pathlib.Path(__file__).parent / "styles.css"
        
        print("\nJavaScript file:")
        print(f"  Path: {esm_path}")
        print(f"  Exists: {esm_path.exists()}")
        if esm_path.exists():
            print(f"  Size: {esm_path.stat().st_size} bytes")
        elif isinstance(self._esm, str):
            print(f"  Content loaded: {len(self._esm)} chars")
        
        print("\nCSS file:")
        print(f"  Path: {css_path}")
        print(f"  Exists: {css_path.exists()}")
        if css_path.exists():
            print(f"  Size: {css_path.stat().st_size} bytes")
        elif isinstance(self._css, str):
            print(f"  Content loaded: {len(self._css)} chars")
        
        # Show current state
        print("\nCurrent state:")
        print(f"  Position: ({self.latitude:.4f}°, {self.longitude:.4f}°)")
        print(f"  Altitude: {self.altitude:.2f}m")
        print(f"  Height: {self.height}")
        print(f"  Terrain: {self.enable_terrain}")
        print(f"  Lighting: {self.enable_lighting}")
        
        print("\n💡 Debugging tips:")
        print("  1. Open browser DevTools (F12) and check the Console tab for errors")
        print("  2. Check Network tab to see if CesiumJS CDN loads successfully")
        print("  3. Try: widget = CesiumWidget(enable_terrain=False) to avoid async terrain loading")
        print("  4. Ensure you're using JupyterLab 4.0+ or Jupyter Notebook 7.0+")
        print("  5. Check if anywidget is properly installed: pip show anywidget")

