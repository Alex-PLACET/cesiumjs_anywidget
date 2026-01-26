"""CesiumJS Anywidget - A Jupyter widget for CesiumJS 3D globe visualization."""

from .widget import CesiumWidget
from .geoid import (
    get_geoid_undulation,
    msl_to_wgs84,
    wgs84_to_msl,
    clear_geoid_cache,
    set_geoid_data_url,
)
from .logger import get_logger, set_log_level
from .exif_utils import extract_all_metadata, extract_gps_data, extract_datetime

__version__ = "0.6.0"
__all__ = [
    "CesiumWidget",
    "get_geoid_undulation",
    "msl_to_wgs84",
    "wgs84_to_msl",
    "clear_geoid_cache",
    "set_geoid_data_url",
    "get_logger",
    "set_log_level",
    "extract_all_metadata",
    "extract_gps_data",
    "extract_datetime",
]
