"""Geoid conversion utilities for MSL to WGS84 altitude conversion.

This module provides functions to convert between Mean Sea Level (MSL) altitudes
and WGS84 ellipsoid heights using the EGM96 geoid model.

The EGM96 15-minute grid data is automatically downloaded from the internet on
first use and cached locally. You can customize the data source URL if needed.
"""

import tarfile
import urllib.request
import zipfile
from functools import lru_cache
from pathlib import Path
from typing import Optional

from .logger import get_logger

logger = get_logger(__name__)


# Default URL for EGM96 15-minute grid data
# This is the official NGA download link
DEFAULT_EGM96_URL = "https://earth-info.nga.mil/php/download.php?file=egm-96interpolation"

# User-configurable URL (can be changed before first use)
_EGM96_DATA_URL: Optional[str] = None

# Cached geoid model
_geoid_model = None

# Cache directory for downloaded geoid files
_CACHE_DIR = Path.home() / ".cache" / "cesiumjs_anywidget" / "geoid"


def set_geoid_data_url(url: str) -> None:
    """Set a custom URL for downloading EGM96 geoid data.
    
    This must be called before the first use of geoid functions.
    
    Parameters
    ----------
    url : str
        URL to download EGM96 grid data (tar.bz2 or direct grid file)
        
    Examples
    --------
    >>> from cesiumjs_anywidget.geoid import set_geoid_data_url
    >>> set_geoid_data_url("https://example.com/egm96-15.tar.bz2")
    """
    global _EGM96_DATA_URL, _geoid_model
    _EGM96_DATA_URL = url
    # Clear cached model to force reload with new URL
    _geoid_model = None
    get_geoid_undulation.cache_clear()


def _download_egm96_grid(url: str, cache_dir: Path) -> Path:
    """Download and extract the EGM96 grid file from an archive (zip or tar.bz2).
    
    Parameters
    ----------
    url : str
        URL to download the archive from
    cache_dir : Path
        Directory to store the extracted grid file
        
    Returns
    -------
    Path
        Path to the extracted .GRD file
        
    Raises
    ------
    FileNotFoundError
        If no .GRD file found in archive
    Exception
        If download or extraction fails
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    
    # Expected output file (WW15MGH.GRD is the standard EGM96 15-minute grid)
    grd_file = cache_dir / "WW15MGH.GRD"
    
    if grd_file.exists():
        return grd_file
    
    # Download the archive
    archive_path = cache_dir / "egm96-data.archive"
    
    if not archive_path.exists():
        logger.info("Downloading EGM96 grid data from %s...", url)
        urllib.request.urlretrieve(url, archive_path)
        logger.info("Download complete: %s", archive_path)
    
    # Detect archive type and extract
    logger.info("Extracting %s...", archive_path)
    
    try:
        # Try ZIP first
        with zipfile.ZipFile(archive_path, 'r') as zip_ref:
            # Find the .GRD file in the archive
            grd_members = [name for name in zip_ref.namelist() 
                          if name.endswith('.GRD') or name.endswith('.grd')]
            
            if not grd_members:
                raise FileNotFoundError(f"No .GRD file found in ZIP archive {archive_path}")
            
            # Extract the first .GRD file found
            member_name = grd_members[0]
            zip_ref.extract(member_name, cache_dir)
            
            # Rename to standard name if needed
            extracted_path = cache_dir / member_name
            if extracted_path.name != grd_file.name:
                extracted_path.rename(grd_file)
                
    except zipfile.BadZipFile:
        # Try tar.bz2
        with tarfile.open(archive_path, "r:bz2") as tar:
            # Find the .GRD file in the archive
            grd_members = [m for m in tar.getmembers() 
                          if m.name.endswith('.GRD') or m.name.endswith('.grd')]
            
            if not grd_members:
                raise FileNotFoundError(f"No .GRD file found in tar.bz2 archive {archive_path}")
            
            # Extract the first .GRD file found
            member = grd_members[0]
            tar.extract(member, cache_dir)
            
            # Rename to standard name if needed
            extracted_path = cache_dir / member.name
            if extracted_path.name != grd_file.name:
                extracted_path.rename(grd_file)
    
    logger.info("Extraction complete: %s", grd_file)
    
    # Clean up archive if extraction successful
    if archive_path.exists() and grd_file.exists():
        archive_path.unlink()
    
    return grd_file


def _get_geoid_model():
    """Get or create the cached EGM96 geoid model.
    
    The model is loaded from GeoidEGM96 using a .GRD grid file.
    The grid file is automatically downloaded on first use and cached locally.
    
    Returns
    -------
    GeoidEGM96
        The cached geoid model instance
    """
    global _geoid_model
    
    if _geoid_model is None:
        from pygeodesy.geoids import GeoidEGM96
        from pygeodesy.datums import Datums
        
        # Use custom URL if set, otherwise use default
        url = _EGM96_DATA_URL if _EGM96_DATA_URL else DEFAULT_EGM96_URL
        
        # Download and extract the grid file if needed
        grd_file = _download_egm96_grid(url, _CACHE_DIR)
        
        # Create the GeoidEGM96 model with the grid file path
        _geoid_model = GeoidEGM96(str(grd_file), datum=Datums.WGS84)
    
    return _geoid_model


@lru_cache(maxsize=1000)
def get_geoid_undulation(latitude: float, longitude: float) -> float:
    """Calculate the geoid undulation at a given location using EGM96.
    
    The geoid undulation (also called geoid height or geoid separation) is the
    height of the geoid above the WGS84 reference ellipsoid. This value is
    needed to convert between GPS/MSL altitudes and WGS84 ellipsoid heights.
    
    On first use, the EGM96 15-minute grid data will be automatically downloaded
    and cached locally. Subsequent calls will use the cached data.
    
    Parameters
    ----------
    latitude : float
        Latitude in degrees (-90 to 90)
    longitude : float
        Longitude in degrees (-180 to 180 or 0 to 360)
        
    Returns
    -------
    float
        Geoid undulation in meters. Positive values indicate the geoid is
        above the WGS84 ellipsoid at this location.
        
    Examples
    --------
    >>> # France (46°N, 4°E) - geoid is about 47m above ellipsoid
    >>> undulation = get_geoid_undulation(46.0, 4.0)
    >>> 45 < undulation < 50
    True
    
    Notes
    -----
    The EGM96 model provides approximately ±0.5 to ±1 meter accuracy globally.
    The grid data is downloaded automatically from GeographicLib on first use.
    """
    geoid = _get_geoid_model()
    
    # GeoidEGM96.height() accepts lat, lon directly
    return geoid.height(latitude, longitude)



def msl_to_wgs84(altitude_msl: float, latitude: float, longitude: float) -> float:
    """Convert Mean Sea Level (MSL) altitude to WGS84 ellipsoid height.
    
    GPS receivers typically report altitude above MSL (geoid), but CZML and
    Cesium use WGS84 ellipsoid heights. This function performs the conversion:
    
        WGS84_height = altitude_msl + geoid_undulation
    
    Parameters
    ----------
    altitude_msl : float
        Altitude above Mean Sea Level in meters
    latitude : float
        Latitude in degrees (-90 to 90)
    longitude : float
        Longitude in degrees (-180 to 180 or 0 to 360)
        
    Returns
    -------
    float
        Height above WGS84 ellipsoid in meters
        
    Examples
    --------
    >>> # Sea level in France would be ~47m above WGS84 ellipsoid
    >>> wgs84_height = msl_to_wgs84(0, 46.0, 4.0)
    >>> 45 < wgs84_height < 50
    True
    
    >>> # Mountain at 1000m MSL
    >>> wgs84_height = msl_to_wgs84(1000, 46.0, 4.0)
    >>> 1045 < wgs84_height < 1050
    True
    """
    geoid_undulation = get_geoid_undulation(latitude, longitude)
    return altitude_msl + geoid_undulation


def wgs84_to_msl(altitude_wgs84: float, latitude: float, longitude: float) -> float:
    """Convert WGS84 ellipsoid height to Mean Sea Level (MSL) altitude.
    
    This is the inverse of msl_to_wgs84. Useful when you have WGS84 heights
    (e.g., from Cesium) and need to display MSL altitudes to users.
    
        altitude_msl = WGS84_height - geoid_undulation
    
    Parameters
    ----------
    altitude_wgs84 : float
        Height above WGS84 ellipsoid in meters
    latitude : float
        Latitude in degrees (-90 to 90)
    longitude : float
        Longitude in degrees (-180 to 180 or 0 to 360)
        
    Returns
    -------
    float
        Altitude above Mean Sea Level in meters
        
    Examples
    --------
    >>> # WGS84 height of ~47m in France is approximately sea level
    >>> msl_alt = wgs84_to_msl(47, 46.0, 4.0)
    >>> -3 < msl_alt < 3
    True
    """
    geoid_undulation = get_geoid_undulation(latitude, longitude)
    return altitude_wgs84 - geoid_undulation


def clear_geoid_cache() -> None:
    """Clear the cached geoid model and undulation values.
    
    This function clears both the geoid model cache and the LRU cache
    used by get_geoid_undulation. Useful for testing or to force reloading
    the geoid data.
    """
    global _geoid_model
    _geoid_model = None
    get_geoid_undulation.cache_clear()
