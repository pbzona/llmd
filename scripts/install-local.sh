#!/bin/bash
# Install llmd to /usr/local/bin

set -e

BINARY="$(pwd)/dist/llmd-v0.1.0-darwin-arm64"

if [ ! -f "$BINARY" ]; then
  echo "❌ Binary not found. Run 'bun run build' first."
  exit 1
fi

echo "Installing llmd to /usr/local/bin..."
sudo ln -sf "$BINARY" /usr/local/bin/llmd

echo "✅ Installed!"
echo ""
echo "Test it:"
echo "  llmd --version"
echo "  llmd --help"
echo ""
echo "To uninstall:"
echo "  sudo rm /usr/local/bin/llmd"
