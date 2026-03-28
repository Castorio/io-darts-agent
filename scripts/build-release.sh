#!/bin/bash

# IO-Darts-Agent - Release Builder
# Builds distributable packages for all platforms

set -e

echo ""
echo "🎯 IO-Darts-Agent Release Builder"
echo "================================="
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# Parse arguments
PLATFORM=""
SKIP_FRONTEND=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --linux) PLATFORM="linux" ;;
    --macos) PLATFORM="macos" ;;
    --macos-arm) PLATFORM="macos-arm64" ;;
    --windows) PLATFORM="windows" ;;
    --skip-frontend) SKIP_FRONTEND=true ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --linux         Build only for Linux"
      echo "  --macos         Build only for macOS (Intel)"
      echo "  --macos-arm     Build only for macOS (Apple Silicon)"
      echo "  --windows       Build only for Windows"
      echo "  --skip-frontend Skip frontend builds"
      echo "  -h, --help      Show this help"
      echo ""
      echo "Without options, builds for all platforms."
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
  shift
done

# Check dependencies
echo "📋 Checking dependencies..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed."; exit 1; }
echo "  ✅ Node.js $(node -v)"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
  echo ""
fi

# Build backend
echo "🔨 Building backend..."
npm run build
echo ""

# Build frontends
if [ "$SKIP_FRONTEND" = false ]; then
  echo "🔨 Building main frontend..."
  cd web
  [ ! -d "node_modules" ] && npm install
  npm run build
  cd ..
  echo ""

  echo "🔨 Building module frontends..."
  for module_dir in modules/*/web; do
    if [ -f "$module_dir/package.json" ]; then
      module_name=$(basename "$(dirname "$module_dir")")
      echo "  Building $module_name..."
      cd "$module_dir"
      [ ! -d "node_modules" ] && npm install
      npm run build
      cd "$ROOT_DIR"
    fi
  done
  echo ""
fi

# Create releases directory
mkdir -p releases

# Build packages
echo "📦 Building release packages..."
echo ""

if [ -n "$PLATFORM" ]; then
  node scripts/package.js "$PLATFORM"
else
  node scripts/package.js
fi

echo ""
echo "✅ Done! Check the 'releases' directory for your packages."
echo ""
