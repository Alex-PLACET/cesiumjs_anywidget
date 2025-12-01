#!/usr/bin/env python3
"""Test script for atmosphere configuration functionality."""

import sys
sys.path.insert(0, 'src')

from cesiumjs_anywidget import CesiumWidget

def test_atmosphere_settings():
    """Test that atmosphere settings can be configured."""
    print("Testing atmosphere configuration...")
    
    # Create widget
    widget = CesiumWidget()
    print("✓ Widget created")
    
    # Test brightness shift
    widget.set_atmosphere(brightness_shift=-0.3)
    assert widget.atmosphere_settings['brightnessShift'] == -0.3
    print("✓ Brightness shift works")
    
    # Test hue and saturation
    widget.set_atmosphere(hue_shift=0.5, saturation_shift=-0.2)
    assert widget.atmosphere_settings['hueShift'] == 0.5
    assert widget.atmosphere_settings['saturationShift'] == -0.2
    print("✓ Hue and saturation shifts work")
    
    # Test light intensity
    widget.set_atmosphere(light_intensity=15.0)
    assert widget.atmosphere_settings['lightIntensity'] == 15.0
    print("✓ Light intensity works")
    
    # Test Rayleigh coefficient (tuple of 3 floats)
    widget.set_atmosphere(rayleigh_coefficient=(5.5e-6, 13.0e-6, 22.4e-6))
    assert len(widget.atmosphere_settings['rayleighCoefficient']) == 3
    print("✓ Rayleigh coefficient works")
    
    # Test Mie coefficient
    widget.set_atmosphere(mie_coefficient=(21e-6, 21e-6, 21e-6))
    assert len(widget.atmosphere_settings['mieCoefficient']) == 3
    print("✓ Mie coefficient works")
    
    # Test scale heights
    widget.set_atmosphere(rayleigh_scale_height=8000.0, mie_scale_height=1200.0)
    assert widget.atmosphere_settings['rayleighScaleHeight'] == 8000.0
    assert widget.atmosphere_settings['mieScaleHeight'] == 1200.0
    print("✓ Scale heights work")
    
    # Test mie anisotropy
    widget.set_atmosphere(mie_anisotropy=0.9)
    assert widget.atmosphere_settings['mieAnisotropy'] == 0.9
    print("✓ Mie anisotropy works")
    
    # Test combined settings
    widget.set_atmosphere(
        brightness_shift=-0.2,
        hue_shift=0.1,
        saturation_shift=0.3
    )
    assert widget.atmosphere_settings['brightnessShift'] == -0.2
    assert widget.atmosphere_settings['hueShift'] == 0.1
    assert widget.atmosphere_settings['saturationShift'] == 0.3
    print("✓ Combined settings work")
    
    # Test reset (empty dict)
    widget.atmosphere_settings = {}
    assert len(widget.atmosphere_settings) == 0
    print("✓ Reset works")
    
    # Test validation
    try:
        widget.set_atmosphere(rayleigh_coefficient=(1.0, 2.0))  # Wrong length
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "must be a tuple of 3 floats" in str(e)
        print("✓ Input validation works")
    
    print("\n✅ All atmosphere configuration tests passed!")
    return True

if __name__ == '__main__':
    try:
        test_atmosphere_settings()
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
