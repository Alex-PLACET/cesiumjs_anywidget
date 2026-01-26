"""Tests for EXIF utilities module."""

import pytest
import tempfile
import shutil
from pathlib import Path
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import piexif

from cesiumjs_anywidget.exif_utils import (
    extract_gps_data,
    extract_datetime,
    extract_camera_info,
    get_image_dimensions,
    extract_all_metadata
)


@pytest.fixture
def temp_dir():
    """Create a temporary directory for test images."""
    temp = tempfile.mkdtemp()
    yield temp
    shutil.rmtree(temp)


def create_test_image_with_exif(path, lat=48.8566, lon=2.3522, alt=100.0):
    """Create a test image with EXIF GPS data."""
    # Create a simple test image
    img = Image.new('RGB', (800, 600), color='red')
    
    # Create EXIF data with GPS
    exif_dict = {
        "0th": {},
        "Exif": {},
        "GPS": {},
        "1st": {},
        "thumbnail": None
    }
    
    # Add GPS data
    def decimal_to_dms(decimal):
        """Convert decimal degrees to degrees, minutes, seconds."""
        is_positive = decimal >= 0
        decimal = abs(decimal)
        degrees = int(decimal)
        minutes = int((decimal - degrees) * 60)
        seconds = int(((decimal - degrees) * 60 - minutes) * 3600)
        return ((degrees, 1), (minutes, 1), (seconds, 1))
    
    exif_dict["GPS"][piexif.GPSIFD.GPSLatitude] = decimal_to_dms(abs(lat))
    exif_dict["GPS"][piexif.GPSIFD.GPSLatitudeRef] = 'N' if lat >= 0 else 'S'
    exif_dict["GPS"][piexif.GPSIFD.GPSLongitude] = decimal_to_dms(abs(lon))
    exif_dict["GPS"][piexif.GPSIFD.GPSLongitudeRef] = 'E' if lon >= 0 else 'W'
    exif_dict["GPS"][piexif.GPSIFD.GPSAltitude] = (int(alt * 100), 100)
    exif_dict["GPS"][piexif.GPSIFD.GPSAltitudeRef] = 0  # Above sea level
    
    # Add camera info
    exif_dict["0th"][piexif.ImageIFD.Make] = b"Canon"
    exif_dict["0th"][piexif.ImageIFD.Model] = b"EOS R5"
    exif_dict["Exif"][piexif.ExifIFD.FocalLength] = (50, 1)
    exif_dict["Exif"][piexif.ExifIFD.DateTimeOriginal] = b"2024:01:15 14:30:00"
    
    # Save image with EXIF
    exif_bytes = piexif.dump(exif_dict)
    img.save(path, "JPEG", exif=exif_bytes)
    
    return path


class TestEXIFExtraction:
    """Test EXIF data extraction functions."""
    
    def test_extract_gps_data(self, temp_dir):
        """Test GPS data extraction."""
        img_path = Path(temp_dir) / "test.jpg"
        create_test_image_with_exif(img_path, lat=48.8566, lon=2.3522, alt=100.0)
        
        gps_data = extract_gps_data(str(img_path))
        
        assert gps_data is not None
        assert 'latitude' in gps_data
        assert 'longitude' in gps_data
        assert 'altitude' in gps_data
        
        # Allow for some rounding errors in DMS conversion
        assert abs(gps_data['latitude'] - 48.8566) < 0.001
        assert abs(gps_data['longitude'] - 2.3522) < 0.001
        assert abs(gps_data['altitude'] - 100.0) < 1.0
    
    def test_extract_gps_data_no_gps(self, temp_dir):
        """Test GPS extraction from image without GPS data."""
        img_path = Path(temp_dir) / "test_no_gps.jpg"
        img = Image.new('RGB', (800, 600), color='blue')
        img.save(img_path, "JPEG")
        
        gps_data = extract_gps_data(str(img_path))
        
        assert gps_data is None
    
    def test_extract_datetime(self, temp_dir):
        """Test datetime extraction."""
        img_path = Path(temp_dir) / "test_dt.jpg"
        create_test_image_with_exif(img_path)
        
        dt = extract_datetime(str(img_path))
        
        assert dt is not None
        assert dt.year == 2024
        assert dt.month == 1
        assert dt.day == 15
        assert dt.hour == 14
        assert dt.minute == 30
    
    def test_extract_camera_info(self, temp_dir):
        """Test camera info extraction."""
        img_path = Path(temp_dir) / "test_cam.jpg"
        create_test_image_with_exif(img_path)
        
        info = extract_camera_info(str(img_path))
        
        assert 'make' in info
        assert 'model' in info
        assert 'focal_length_mm' in info
        assert info['make'] == 'Canon'
        assert info['model'] == 'EOS R5'
        assert info['focal_length_mm'] == 50.0
    
    def test_get_image_dimensions(self, temp_dir):
        """Test image dimensions retrieval."""
        img_path = Path(temp_dir) / "test_dims.jpg"
        img = Image.new('RGB', (1920, 1080), color='green')
        img.save(img_path, "JPEG")
        
        dims = get_image_dimensions(str(img_path))
        
        assert dims is not None
        assert dims == (1920, 1080)
    
    def test_extract_all_metadata(self, temp_dir):
        """Test comprehensive metadata extraction."""
        img_path = Path(temp_dir) / "test_all.jpg"
        create_test_image_with_exif(img_path, lat=40.7128, lon=-74.0060, alt=50.0)
        
        metadata = extract_all_metadata(str(img_path))
        
        assert metadata is not None
        assert 'latitude' in metadata
        assert 'longitude' in metadata
        assert 'altitude' in metadata
        assert 'datetime' in metadata
        assert 'make' in metadata
        assert 'model' in metadata
        assert 'focal_length_mm' in metadata
        assert 'width' in metadata
        assert 'height' in metadata
        
        assert abs(metadata['latitude'] - 40.7128) < 0.001
        assert abs(metadata['longitude'] - (-74.0060)) < 0.001
        assert metadata['width'] == 800
        assert metadata['height'] == 600
