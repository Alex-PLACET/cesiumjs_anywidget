#!/usr/bin/env bash

# Quick test runner for cesiumjs_anywidget
# This script runs the test suite with common options

set -e

echo "🧪 Running CesiumJS Anywidget Test Suite"
echo "========================================"
echo ""

# Check if pytest is installed
if ! command -v pytest &> /dev/null; then
    echo "❌ pytest is not installed."
    echo "📦 Installing test dependencies..."
    uv pip install -e ".[dev]"
    echo ""
fi

# Parse command line arguments
COVERAGE=false
VERBOSE=false
FAST=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--coverage)
            COVERAGE=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -f|--fast)
            FAST=true
            shift
            ;;
        -h|--help)
            echo "Usage: ./run_tests.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -c, --coverage    Run with coverage report"
            echo "  -v, --verbose     Run with verbose output"
            echo "  -f, --fast        Skip slow tests"
            echo "  -h, --help        Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Build pytest command
PYTEST_CMD="pytest"

if [ "$VERBOSE" = true ]; then
    PYTEST_CMD="$PYTEST_CMD -v"
fi

if [ "$FAST" = true ]; then
    PYTEST_CMD="$PYTEST_CMD -m 'not slow'"
fi

if [ "$COVERAGE" = true ]; then
    PYTEST_CMD="$PYTEST_CMD --cov=cesiumjs_anywidget --cov-report=html --cov-report=term-missing"
fi

# Run tests
echo "Running: $PYTEST_CMD"
echo ""
$PYTEST_CMD

# Show coverage report location if generated
if [ "$COVERAGE" = true ]; then
    echo ""
    echo "📊 Coverage report generated:"
    echo "   Open htmlcov/index.html in your browser"
fi

echo ""
echo "✅ Tests complete!"
