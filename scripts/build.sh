#!/bin/bash
# Build script for llmd

set -e

echo "Type checking..."
bun x tsc --noEmit

echo "Cleaning previous builds..."
rm -rf dist llmd.js*

echo "Creating dist directory..."
mkdir -p dist

echo "Building client bundle..."
bun build --target=browser --minify ./src/client-bundle.ts --outfile=dist/client.js

echo "Building server bundle..."
bun build --target=node --minify --sourcemap --external libsql ./index.ts --outfile=llmd.js

echo "Moving bundles to dist..."
mv llmd.js* dist/

echo "Updating shebang..."
sed -i.bak '1s|#!/usr/bin/env bun|#!/usr/bin/env node|' dist/llmd.js
rm -f dist/llmd.js.bak

echo "Renaming and making executable..."
mv dist/llmd.js dist/llmd
chmod +x dist/llmd

echo "✓ Build complete!"
