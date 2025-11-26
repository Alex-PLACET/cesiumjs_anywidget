#!/usr/bin/env python3
"""Test script for camera control functionality."""

import sys
sys.path.insert(0, 'src')

from cesiumjs_anywidget import CesiumWidget

def test_camera_controls():
    """Test that camera controls work correctly."""
    print("Testing camera controls...")
    
    # Create widget
    widget = CesiumWidget()
    print("✓ Widget created")
    
    # Test fly_to
    widget.fly_to(48.8566, 2.3522, altitude=5000, duration=2.0)
    cmd = widget.camera_command
    assert cmd['command'] == 'flyTo'
    assert cmd['latitude'] == 48.8566
    assert cmd['longitude'] == 2.3522
    assert cmd['altitude'] == 5000
    assert cmd['duration'] == 2.0
    print("✓ fly_to works")
    
    # Test fly_to with orientation
    widget.fly_to(40.7128, -74.0060, altitude=3000, heading=45, pitch=-30, roll=5)
    cmd = widget.camera_command
    assert cmd['heading'] == 45
    assert cmd['pitch'] == -30
    assert cmd['roll'] == 5
    print("✓ fly_to with orientation works")
    
    # Test set_view
    widget.set_view(51.5074, -0.1278, altitude=2000)
    cmd = widget.camera_command
    assert cmd['command'] == 'setView'
    assert cmd['latitude'] == 51.5074
    assert cmd['longitude'] == -0.1278
    assert cmd['altitude'] == 2000
    print("✓ set_view works")
    
    # Test look_at
    widget.look_at(48.8584, 2.2945, target_altitude=300, offset_range=500, offset_pitch=-30)
    cmd = widget.camera_command
    assert cmd['command'] == 'lookAt'
    assert cmd['targetLatitude'] == 48.8584
    assert cmd['targetLongitude'] == 2.2945
    assert cmd['targetAltitude'] == 300
    assert cmd['offsetRange'] == 500
    assert cmd['offsetPitch'] == -30
    print("✓ look_at works")
    
    # Test movement commands
    widget.move_forward(500)
    assert widget.camera_command['command'] == 'moveForward'
    assert widget.camera_command['distance'] == 500
    print("✓ move_forward works")
    
    widget.move_backward(300)
    assert widget.camera_command['command'] == 'moveBackward'
    assert widget.camera_command['distance'] == 300
    print("✓ move_backward works")
    
    widget.move_up(200)
    assert widget.camera_command['command'] == 'moveUp'
    print("✓ move_up works")
    
    widget.move_down(150)
    assert widget.camera_command['command'] == 'moveDown'
    print("✓ move_down works")
    
    widget.move_left(100)
    assert widget.camera_command['command'] == 'moveLeft'
    print("✓ move_left works")
    
    widget.move_right(100)
    assert widget.camera_command['command'] == 'moveRight'
    print("✓ move_right works")
    
    # Test rotation commands
    widget.rotate_left(45)
    assert widget.camera_command['command'] == 'rotateLeft'
    assert widget.camera_command['angle'] == 45
    print("✓ rotate_left works")
    
    widget.rotate_right(30)
    assert widget.camera_command['command'] == 'rotateRight'
    assert widget.camera_command['angle'] == 30
    print("✓ rotate_right works")
    
    widget.rotate_up(20)
    assert widget.camera_command['command'] == 'rotateUp'
    print("✓ rotate_up works")
    
    widget.rotate_down(25)
    assert widget.camera_command['command'] == 'rotateDown'
    print("✓ rotate_down works")
    
    # Test zoom commands
    widget.zoom_in(500)
    assert widget.camera_command['command'] == 'zoomIn'
    assert widget.camera_command['distance'] == 500
    print("✓ zoom_in works")
    
    widget.zoom_out(400)
    assert widget.camera_command['command'] == 'zoomOut'
    assert widget.camera_command['distance'] == 400
    print("✓ zoom_out works")
    
    # Test set_camera
    initial_lat = widget.latitude
    widget.set_camera(pitch=-60)
    assert widget.pitch == -60
    assert widget.latitude == initial_lat  # Other properties unchanged
    print("✓ set_camera works")
    
    widget.set_camera(latitude=35.0, longitude=-110.0, altitude=10000)
    assert widget.latitude == 35.0
    assert widget.longitude == -110.0
    assert widget.altitude == 10000
    print("✓ set_camera with multiple properties works")
    
    # Test that commands have timestamps
    widget.fly_to(0, 0)
    assert 'timestamp' in widget.camera_command
    assert widget.camera_command['timestamp'] > 0
    print("✓ Commands include timestamps")
    
    print("\n✅ All camera control tests passed!")
    return True

if __name__ == '__main__':
    try:
        test_camera_controls()
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
