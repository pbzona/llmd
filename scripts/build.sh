#!/bin/bash
# Build llmd binary for current platform

set -e

# Get version from package.json
VERSION=$(cat package.json | grep '"version"' | sed 's/.*"version": "\(.*\)".*/\1/')

# Detect platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Normalize arch names
case "$ARCH" in
  x86_64)
    ARCH="x64"
    ;;
  aarch64)
    ARCH="arm64"
    ;;
  arm64)
    ARCH="arm64"
    ;;
esac

# Output filename
OUTPUT="llmd-v${VERSION}-${OS}-${ARCH}"

echo "Building $OUTPUT..."

# Compile with Bun
bun build --compile --minify --sourcemap ./index.ts --outfile "dist/${OUTPUT}"

echo "✓ Built: dist/${OUTPUT}"
echo "  Size: $(ls -lh dist/${OUTPUT} | awk '{print $5}')"
