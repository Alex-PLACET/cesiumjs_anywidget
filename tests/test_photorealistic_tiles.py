"""Tests for Google Photorealistic 3D Tiles functionality."""

from cesiumjs_anywidget import CesiumWidget


def test_photorealistic_tiles_default_disabled():
    """Test that photorealistic tiles are disabled by default."""
    widget = CesiumWidget()
    assert widget.enable_photorealistic_tiles is False
    assert widget.show_globe is True


def test_photorealistic_tiles_enable_on_creation():
    """Test enabling photorealistic tiles during widget creation."""
    widget = CesiumWidget(
        enable_photorealistic_tiles=True,
        show_globe=False,
        enable_terrain=False
    )
    assert widget.enable_photorealistic_tiles is True
    assert widget.show_globe is False
    assert widget.enable_terrain is False


def test_photorealistic_tiles_enable_after_creation():
    """Test enabling photorealistic tiles after widget creation."""
    widget = CesiumWidget()
    
    # Initially disabled
    assert widget.enable_photorealistic_tiles is False
    
    # Enable it
    widget.enable_photorealistic_tiles = True
    assert widget.enable_photorealistic_tiles is True
    
    # Disable it
    widget.enable_photorealistic_tiles = False
    assert widget.enable_photorealistic_tiles is False


def test_enable_photorealistic_3d_tiles_method():
    """Test the convenience method for enabling photorealistic tiles."""
    widget = CesiumWidget()
    
    # Initially disabled
    assert widget.enable_photorealistic_tiles is False
    assert widget.show_globe is True
    
    # Enable using convenience method
    widget.enable_photorealistic_3d_tiles(True)
    assert widget.enable_photorealistic_tiles is True
    assert widget.show_globe is False
    assert widget.enable_terrain is False
    
    # Disable using convenience method
    widget.enable_photorealistic_3d_tiles(False)
    assert widget.enable_photorealistic_tiles is False
    assert widget.show_globe is True


def test_enable_photorealistic_3d_tiles_default_parameter():
    """Test that the convenience method defaults to True."""
    widget = CesiumWidget()
    
    # Call without parameter (should default to True)
    widget.enable_photorealistic_3d_tiles()
    assert widget.enable_photorealistic_tiles is True
    assert widget.show_globe is False


def test_show_globe_independent_control():
    """Test that show_globe can be controlled independently."""
    widget = CesiumWidget(enable_photorealistic_tiles=True)
    
    # Initially should be whatever default is
    # Enable photorealistic tiles, disable globe
    widget.show_globe = False
    assert widget.show_globe is False
    
    # Re-enable globe (hybrid mode)
    widget.show_globe = True
    assert widget.show_globe is True
    assert widget.enable_photorealistic_tiles is True


def test_photorealistic_tiles_with_other_settings():
    """Test photorealistic tiles work with other widget settings."""
    widget = CesiumWidget(
        enable_photorealistic_tiles=True,
        show_globe=False,
        enable_terrain=False,
        enable_lighting=True,
        height="800px",
        latitude=40.7128,
        longitude=-74.0060,
        altitude=2000
    )
    
    assert widget.enable_photorealistic_tiles is True
    assert widget.show_globe is False
    assert widget.enable_terrain is False
    assert widget.enable_lighting is True
    assert widget.height == "800px"
    assert widget.latitude == 40.7128
    assert widget.longitude == -74.0060
    assert widget.altitude == 2000


def test_photorealistic_tiles_state_changes():
    """Test multiple state changes of photorealistic tiles."""
    widget = CesiumWidget()
    
    # Toggle multiple times
    for i in range(3):
        widget.enable_photorealistic_tiles = True
        assert widget.enable_photorealistic_tiles is True
        
        widget.enable_photorealistic_tiles = False
        assert widget.enable_photorealistic_tiles is False


def test_photorealistic_tiles_with_camera_methods():
    """Test that photorealistic tiles work with camera control methods."""
    widget = CesiumWidget(enable_photorealistic_tiles=True, show_globe=False)
    
    # Test fly_to
    widget.fly_to(latitude=40.7128, longitude=-74.0060, altitude=2000)
    assert widget.enable_photorealistic_tiles is True
    
    # Test set_view
    widget.set_view(latitude=48.8566, longitude=2.3522, altitude=1500)
    assert widget.enable_photorealistic_tiles is True


def test_photorealistic_tiles_traitlet_sync():
    """Test that photorealistic tiles settings are properly tagged for sync."""
    widget = CesiumWidget()
    
    # Check that the trait has sync tag
    trait = widget.traits()['enable_photorealistic_tiles']
    assert trait.metadata.get('sync', False) is True
    
    trait = widget.traits()['show_globe']
    assert trait.metadata.get('sync', False) is True
