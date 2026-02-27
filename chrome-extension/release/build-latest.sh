#!/bin/bash
# Build Popouts-latest.zip for distribution (side-load or sharing).
# Run from chrome-extension/ or release/ directory.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_ZIP="$SCRIPT_DIR/Popouts-latest.zip"

cd "$EXT_DIR"
rm -f "$OUTPUT_ZIP"

zip -r "$OUTPUT_ZIP" . \
  -x "*.md" \
  -x "*.DS_Store" \
  -x ".git/*" \
  -x "node_modules/*" \
  -x "*.pem" \
  -x "package-extension.sh" \
  -x "package-chrome-store.sh" \
  -x "restore-data.js" \
  -x "backup-data.js" \
  -x "scripts/*" \
  -x "icons/generate-icons.html" \
  -x "icons/generate-icons.js" \
  -x "icons/generate-category-icons.html" \
  -x "icons/create_icons.html" \
  -x "icons/ICON_*.md" \
  -x "icons/README.md" \
  -x "icons/icon.svg" \
  -x "icons/icon*-1.png" \
  -x "js/modules/README.md" \
  -x "release/*"

echo "Created: $OUTPUT_ZIP"
echo "Size: $(ls -lh "$OUTPUT_ZIP" | awk '{print $5}')"
