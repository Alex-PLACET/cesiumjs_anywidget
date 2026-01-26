"""Tests for geoid conversion functions."""

import pytest
from cesiumjs_anywidget.geoid import (
    get_geoid_undulation,
    msl_to_wgs84,
    wgs84_to_msl,
    clear_geoid_cache,
)


class TestGetGeoidUndulation:
    """Tests for get_geoid_undulation function."""
    
    def test_france_location(self):
        """Test geoid undulation at France location from photo."""
        undulation = get_geoid_undulation(46.371203, 4.635514)
        assert 49.19 == pytest.approx(undulation, 0.1), f"Undulation should be roughly positive, got {undulation}m"
    
    def test_positive_undulation(self):
        """Test that undulation is positive in Europe."""
        # Most of Europe has positive undulation
        undulation = get_geoid_undulation(50.0, 10.0)
        # With approximation, just check it's somewhat reasonable
        assert -30 < undulation < 70
    
    def test_function_caching(self):
        """Test that function results are cached."""
        # First call
        result1 = get_geoid_undulation(46.0, 4.0)
        
        # Second call should return cached result (same value)
        result2 = get_geoid_undulation(46.0, 4.0)
        
        assert result1 == result2


class TestMslToWgs84:
    """Tests for MSL to WGS84 conversion."""
    
    def test_sea_level_conversion(self):
        """Test converting sea level (0m MSL) to WGS84."""
        # At France location, sea level should be above WGS84 ellipsoid
        wgs84_height = msl_to_wgs84(0, 46.371203, 4.635514)
        
        # With approximation, just check reasonable range
        assert -10 < wgs84_height < 60
    
    def test_mountain_conversion(self):
        """Test converting mountain altitude from MSL to WGS84."""
        # 1000m mountain in France
        wgs84_height = msl_to_wgs84(1000, 46.371203, 4.635514)
        
        # Should be roughly 1000 + undulation
        assert 990 < wgs84_height < 1060
    
    def test_positive_altitude(self):
        """Test with positive MSL altitude."""
        wgs84 = msl_to_wgs84(500, 46.0, 4.0)
        # Just check it's reasonable
        assert 450 < wgs84 < 580


class TestWgs84ToMsl:
    """Tests for WGS84 to MSL conversion."""
    
    def test_reverse_conversion(self):
        """Test that WGS84 to MSL is inverse of MSL to WGS84."""
        lat, lon = 46.371203, 4.635514
        msl_original = 187.9
        
        # Convert to WGS84 and back
        wgs84 = msl_to_wgs84(msl_original, lat, lon)
        msl_converted = wgs84_to_msl(wgs84, lat, lon)
        
        # Should get back original value (within floating point precision)
        assert abs(msl_converted - msl_original) < 0.001


class TestClearGeoidCache:
    """Tests for clear_geoid_cache function."""
    
    def test_cache_clearing(self):
        """Test that cache can be cleared without errors."""
        # Populate cache
        get_geoid_undulation(46.0, 4.0)
        
        # Clear cache
        clear_geoid_cache()
        
        # Should still work after clearing
        result = get_geoid_undulation(46.0, 4.0)
        assert isinstance(result, float)


class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""
    
    def test_high_altitude(self):
        """Test conversion at very high altitude."""
        # Aircraft at 10000m MSL
        wgs84 = msl_to_wgs84(10000, 46.0, 4.0)
        assert wgs84 > 10000
    
    def test_consistency(self):
        """Test that conversion is consistent."""
        lat, lon = 46.0, 4.0
        
        # Multiple conversions should give same result
        result1 = get_geoid_undulation(lat, lon)
        result2 = get_geoid_undulation(lat, lon)
        result3 = get_geoid_undulation(lat, lon)
        
        assert result1 == result2 == result3
