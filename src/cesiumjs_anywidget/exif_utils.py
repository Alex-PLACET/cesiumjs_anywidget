"""EXIF data extraction utilities for photo geolocation."""

import exifread
from datetime import datetime
from typing import Optional, Dict, Any, Tuple
from pathlib import Path
from .logger import get_logger

logger = get_logger(__name__)


def _convert_to_degrees(value) -> float:
    """Convert GPS coordinates to degrees.
    
    Parameters
    ----------
    value : exifread.utils.Ratio list
        GPS coordinate in degrees, minutes, seconds format
        
    Returns
    -------
    float
        Coordinate in decimal degrees
    """
    d = float(value.values[0].num) / float(value.values[0].den)
    m = float(value.values[1].num) / float(value.values[1].den)
    s = float(value.values[2].num) / float(value.values[2].den)

    # Normalize malformed DMS values from some writers
    # Some encoders store seconds as total arc-seconds * 60 (e.g., 1425 instead of 23.75)
    if s >= 60 and m < 60:
        s = s / 60.0

    if s >= 60:
        carry = int(s // 60)
        s = s - (carry * 60)
        m += carry

    if m >= 60:
        carry = int(m // 60)
        m = m - (carry * 60)
        d += carry

    return d + (m / 60.0) + (s / 3600.0)


def extract_gps_data(image_path: str) -> Optional[Dict[str, float]]:
    """Extract GPS coordinates from image EXIF data.
    
    Parameters
    ----------
    image_path : str
        Path to the image file
        
    Returns
    -------
    dict or None
        Dictionary containing 'latitude', 'longitude', and optionally 'altitude'
        Returns None if GPS data is not available
        
    Examples
    --------
    >>> gps_data = extract_gps_data('photo.jpg')
    >>> if gps_data:
    ...     print(f"Location: {gps_data['latitude']}, {gps_data['longitude']}")
    """
    try:
        with open(image_path, 'rb') as f:
            tags = exifread.process_file(f, details=False)
        
        # Check if GPS data exists
        if 'GPS GPSLatitude' not in tags or 'GPS GPSLongitude' not in tags:
            logger.warning(f"No GPS data found in {image_path}")
            return None
        
        # Extract latitude
        lat = _convert_to_degrees(tags['GPS GPSLatitude'])
        if tags.get('GPS GPSLatitudeRef', 'N').values[0] == 'S':
            lat = -lat
        
        # Extract longitude
        lon = _convert_to_degrees(tags['GPS GPSLongitude'])
        if tags.get('GPS GPSLongitudeRef', 'E').values[0] == 'W':
            lon = -lon
        
        result = {
            'latitude': lat,
            'longitude': lon,
        }
        
        # Extract altitude if available
        if 'GPS GPSAltitude' in tags:
            alt_tag = tags['GPS GPSAltitude']
            altitude = float(alt_tag.values[0].num) / float(alt_tag.values[0].den)
            
            # Check altitude reference (0 = above sea level, 1 = below sea level)
            if 'GPS GPSAltitudeRef' in tags:
                alt_ref = tags['GPS GPSAltitudeRef'].values[0]
                if alt_ref == 1:
                    altitude = -altitude
            
            result['altitude'] = altitude
        
        logger.info(f"Extracted GPS data from {image_path}: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Error extracting GPS data from {image_path}: {e}")
        return None


def extract_datetime(image_path: str) -> Optional[datetime]:
    """Extract capture datetime from image EXIF data.
    
    Parameters
    ----------
    image_path : str
        Path to the image file
        
    Returns
    -------
    datetime or None
        Image capture datetime, or None if not available
        
    Examples
    --------
    >>> dt = extract_datetime('photo.jpg')
    >>> if dt:
    ...     print(f"Captured on: {dt.strftime('%Y-%m-%d %H:%M:%S')}")
    """
    try:
        with open(image_path, 'rb') as f:
            tags = exifread.process_file(f, details=False)
        
        # Try different datetime tags
        for tag_name in ['EXIF DateTimeOriginal', 'EXIF DateTime', 'Image DateTime']:
            if tag_name in tags:
                dt_str = str(tags[tag_name])
                # Parse datetime (format: "YYYY:MM:DD HH:MM:SS")
                dt = datetime.strptime(dt_str, '%Y:%m:%d %H:%M:%S')
                logger.info(f"Extracted datetime from {image_path}: {dt}")
                return dt
        
        logger.warning(f"No datetime found in {image_path}")
        return None
        
    except Exception as e:
        logger.error(f"Error extracting datetime from {image_path}: {e}")
        return None


def extract_camera_info(image_path: str) -> Dict[str, Any]:
    """Extract camera information from image EXIF data.
    
    Parameters
    ----------
    image_path : str
        Path to the image file
        
    Returns
    -------
    dict
        Dictionary containing camera make, model, focal length, sensor size, etc.
        
    Examples
    --------
    >>> info = extract_camera_info('photo.jpg')
    >>> print(f"Camera: {info.get('make')} {info.get('model')}")
    """
    result = {}
    
    try:
        with open(image_path, 'rb') as f:
            tags = exifread.process_file(f, details=False)
        
        # Camera make and model
        if 'Image Make' in tags:
            result['make'] = str(tags['Image Make'])
        if 'Image Model' in tags:
            result['model'] = str(tags['Image Model'])
        
        # Focal length
        if 'EXIF FocalLength' in tags:
            focal_tag = tags['EXIF FocalLength']
            focal_length = float(focal_tag.values[0].num) / float(focal_tag.values[0].den)
            result['focal_length_mm'] = focal_length
        
        # Focal length in 35mm equivalent
        if 'EXIF FocalLengthIn35mmFilm' in tags:
            result['focal_length_35mm'] = int(tags['EXIF FocalLengthIn35mmFilm'].values[0])
        
        # Image dimensions
        if 'EXIF ExifImageWidth' in tags:
            result['image_width'] = int(tags['EXIF ExifImageWidth'].values[0])
        if 'EXIF ExifImageLength' in tags:
            result['image_height'] = int(tags['EXIF ExifImageLength'].values[0])
        
        # Orientation
        if 'Image Orientation' in tags:
            result['orientation'] = str(tags['Image Orientation'])
        
        logger.info(f"Extracted camera info from {image_path}: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Error extracting camera info from {image_path}: {e}")
        return result


def get_image_dimensions(image_path: str) -> Optional[Tuple[int, int]]:
    """Get image dimensions (width, height) from file.
    
    Parameters
    ----------
    image_path : str
        Path to the image file
        
    Returns
    -------
    tuple or None
        (width, height) in pixels, or None if unable to read
    """
    try:
        from PIL import Image
        with Image.open(image_path) as img:
            return img.size
    except Exception as e:
        logger.error(f"Error reading image dimensions from {image_path}: {e}")
        return None


def extract_all_metadata(image_path: str) -> Dict[str, Any]:
    """Extract all relevant metadata from an image.
    
    Combines GPS, datetime, camera info, and image dimensions into one dictionary.
    
    Parameters
    ----------
    image_path : str
        Path to the image file
        
    Returns
    -------
    dict
        Dictionary containing all extracted metadata
        
    Examples
    --------
    >>> metadata = extract_all_metadata('photo.jpg')
    >>> print(metadata)
    {'latitude': 48.8566, 'longitude': 2.3522, 'altitude': 100,
     'datetime': datetime(2024, 1, 15, 14, 30, 0),
     'make': 'Canon', 'model': 'EOS R5', ...}
    """
    metadata = {
        'file_path': str(Path(image_path).absolute()),
        'file_name': Path(image_path).name,
    }
    
    # GPS data
    gps_data = extract_gps_data(image_path)
    if gps_data:
        metadata.update(gps_data)
    
    # Datetime
    dt = extract_datetime(image_path)
    if dt:
        metadata['datetime'] = dt
        metadata['datetime_str'] = dt.isoformat()
    
    # Camera info
    camera_info = extract_camera_info(image_path)
    metadata.update(camera_info)
    
    # Image dimensions
    dims = get_image_dimensions(image_path)
    if dims:
        metadata['width'] = dims[0]
        metadata['height'] = dims[1]
    
    return metadata
