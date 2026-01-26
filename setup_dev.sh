#!/usr/bin/env bash

# Setup script for cesiumjs_anywidget development environment
# This script helps you quickly set up the development environment

set -e

echo "🌍 Setting up CesiumJS Anywidget Development Environment"
echo "========================================================"
echo ""

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ uv is not installed."
    echo "📦 Please install uv first: https://github.com/astral-sh/uv"
    echo ""
    echo "Quick install:"
    echo "  curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

echo "✅ uv found"
echo ""

# Install the package in editable mode with dev dependencies
echo "📦 Installing package in editable mode with dev dependencies..."
uv pip install -e ".[dev]"
echo ""

# Check if installation was successful
if python -c "import cesiumjs_anywidget" 2>/dev/null; then
    echo "✅ Package installed successfully!"
else
    echo "❌ Package installation failed"
    exit 1
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Enable hot module replacement (optional):"
echo "     export ANYWIDGET_HMR=1"
echo ""
echo "  2. Launch JupyterLab:"
echo "     jupyter lab"
echo ""
echo "  3. Open examples/demo.ipynb to see the widget in action"
echo ""
echo "📚 See DEVELOPMENT.md for more information"
