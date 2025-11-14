# Tests for CesiumJS Anywidget

This directory contains the test suite for the cesiumjs_anywidget package.

## Running Tests

### Install Test Dependencies

```bash
uv pip install -e ".[dev]"
```

### Run All Tests

```bash
pytest
```

### Run with Coverage

```bash
pytest --cov=cesiumjs_anywidget --cov-report=html
```

Then open `htmlcov/index.html` to view the coverage report.

### Run Specific Test Files

```bash
# Run only widget tests
pytest tests/test_widget.py

# Run only method tests
pytest tests/test_methods.py

# Run only integration tests
pytest tests/test_integration.py
```

### Run Specific Test Classes

```bash
pytest tests/test_widget.py::TestWidgetInitialization
```

### Run Specific Tests

```bash
pytest tests/test_widget.py::TestWidgetInitialization::test_widget_creation
```

### Verbose Output

```bash
pytest -v
```

### Show Print Statements

```bash
pytest -s
```

## Test Structure

- `conftest.py` - Pytest configuration and shared fixtures
- `test_widget.py` - Unit tests for widget initialization and configuration
- `test_methods.py` - Tests for widget methods (fly_to, set_view, load_geojson)
- `test_integration.py` - Integration tests for package structure and multi-instance behavior
- `__init__.py` - Test package initialization

## Test Coverage

The test suite aims for high coverage of:

- Widget initialization with various configurations
- All public methods and their parameters
- Traitlet behavior and type validation
- File path resolution and existence
- Multiple widget instances
- Edge cases and boundary conditions
- Documentation presence

## Writing New Tests

### Using Fixtures

Fixtures are defined in `conftest.py`:

```python
def test_my_feature(widget_instance):
    """Test using the widget_instance fixture."""
    widget_instance.latitude = 10.0
    assert widget_instance.latitude == 10.0
```

### Available Fixtures

- `widget_class` - The CesiumWidget class
- `widget_instance` - A basic widget instance with defaults
- `widget_with_config` - A widget with custom configuration
- `sample_geojson` - Sample GeoJSON data for testing
- `project_root` - Path to project root directory

### Test Organization

Organize tests into classes for related functionality:

```python
class TestMyFeature:
    """Test my feature."""
    
    def test_basic_behavior(self, widget_instance):
        """Test basic behavior."""
        pass
    
    def test_edge_case(self, widget_instance):
        """Test edge case."""
        pass
```

## Continuous Integration

These tests are designed to run in CI/CD pipelines. They don't require:
- A running Jupyter server
- Browser automation
- Network access (except for import checks)

## Troubleshooting

### Import Errors

If you get import errors, ensure the package is installed in editable mode:

```bash
uv pip install -e .
```

### Missing Dependencies

Install test dependencies:

```bash
uv pip install -e ".[dev]"
```

### PYTHONPATH Issues

The test suite automatically adds the `src` directory to the Python path in `__init__.py`.

## Test Markers

Tests can be marked with custom markers defined in `pyproject.toml`:

```python
@pytest.mark.slow
def test_slow_operation():
    """This test takes a long time."""
    pass
```

Run only fast tests:

```bash
pytest -m "not slow"
```

## Coverage Reports

After running tests with coverage, you can view:

- **Terminal report**: Shows coverage percentages
- **HTML report**: Detailed line-by-line coverage in `htmlcov/`
- **Missing lines**: Lists lines not covered by tests

Aim for at least 80% coverage for new code.
