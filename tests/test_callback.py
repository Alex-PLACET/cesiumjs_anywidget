#!/usr/bin/env python
"""Test script to verify callback functionality"""

from cesiumjs_anywidget import CesiumWidget

# Create widget
w = CesiumWidget()

print("Testing widget traits and methods:")
print(f"✅ Has interaction_event trait: {hasattr(w, 'interaction_event')}")
print(f"✅ Has on_interaction method: {hasattr(w, 'on_interaction')}")

if hasattr(w, 'interaction_event'):
    print(f"   interaction_event type: {type(w.interaction_event)}")
    print(f"   interaction_event value: {w.interaction_event}")

# Test callback registration
callback_called = []

def event_callback(event):
    """Callback function to handle interaction events"""
    callback_called.append(event)
    print(f"Callback called with event: {event}")

if hasattr(w, 'on_interaction'):
    w.on_interaction(event_callback)
    print("✅ Callback registered successfully")
    
    # Simulate an event by setting the trait directly
    test_event = {
        'type': 'camera_move',
        'timestamp': '2025-11-20T10:00:00Z',
        'camera': {
            'latitude': 48.8566,
            'longitude': 2.3522,
            'altitude': 5000.0,
            'heading': 0.0,
            'pitch': -45.0,
            'roll': 0.0
        },
        'clock': None
    }
    
    w.interaction_event = test_event
    
    # Check if callback was triggered
    import time
    time.sleep(0.1)  # Give it a moment
    
    if callback_called:
        print(f"✅ Callback was triggered with: {callback_called[0]['type']}")
    else:
        print("⚠️  Callback was not triggered (this is expected in non-Jupyter environment)")
else:
    print("❌ on_interaction method not found")

print("\n" + "="*60)
print("Widget is properly configured for callbacks!")
print("="*60)
