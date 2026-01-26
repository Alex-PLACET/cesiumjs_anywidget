#!/usr/bin/env python3
"""Test script for skybox configuration functionality."""

import sys
sys.path.insert(0, 'src')

from cesiumjs_anywidget import CesiumWidget

def test_skybox_settings():
    """Test that skybox settings can be configured."""
    print("Testing skybox configuration...")
    
    # Create widget
    widget = CesiumWidget()
    print("✓ Widget created")
    
    # Test show/hide
    widget.set_skybox(show=False)
    assert not widget.skybox_settings['show']
    print("✓ Show/hide works")
    
    widget.set_skybox(show=True)
    assert widget.skybox_settings['show']
    print("✓ Show enabled")
    
    # Test custom sources (all 6 faces required)
    custom_sources = {
        'positiveX': 'https://example.com/right.jpg',
        'negativeX': 'https://example.com/left.jpg',
        'positiveY': 'https://example.com/top.jpg',
        'negativeY': 'https://example.com/bottom.jpg',
        'positiveZ': 'https://example.com/front.jpg',
        'negativeZ': 'https://example.com/back.jpg'
    }
    widget.set_skybox(sources=custom_sources)
    assert widget.skybox_settings['sources'] == custom_sources
    print("✓ Custom sources work")
    
    # Test combined settings
    widget.set_skybox(show=True, sources=custom_sources)
    assert widget.skybox_settings['show']
    assert widget.skybox_settings['sources'] == custom_sources
    print("✓ Combined settings work")
    
    # Test reset (empty dict)
    widget.skybox_settings = {}
    assert len(widget.skybox_settings) == 0
    print("✓ Reset works")
    
    # Test validation - missing faces should raise error
    try:
        widget.set_skybox(sources={'positiveX': 'url.jpg'})  # Missing other faces
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "must include all cube map faces" in str(e)
        print("✓ Validation for missing faces works")
    
    # Test validation - sources must be dict
    try:
        widget.set_skybox(sources="not a dict")
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "must be a dictionary" in str(e)
        print("✓ Validation for sources type works")
    
    print("\n✅ All skybox configuration tests passed!")
    return True

if __name__ == '__main__':
    try:
        test_skybox_settings()
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
