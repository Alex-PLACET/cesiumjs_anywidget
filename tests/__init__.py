"""Test suite initialization and package-level tests."""

import sys
import pathlib

# Add the src directory to the path for testing
project_root = pathlib.Path(__file__).parent.parent
src_path = project_root / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))


def test_imports():
    """Test that basic imports work."""
    import cesiumjs_anywidget
    from cesiumjs_anywidget import CesiumWidget
    
    assert cesiumjs_anywidget is not None
    assert CesiumWidget is not None
