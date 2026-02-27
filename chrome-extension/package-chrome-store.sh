#!/bin/bash
# Package Popouts Chrome extension for Chrome Web Store submission.
# Creates a ZIP file ready to upload at https://chrome.google.com/webstore/devconsole

set -e

EXT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_ZIP="$EXT_DIR/Popouts-chrome-store.zip"

# Verify required files exist
for f in manifest.json icons/icon16.png icons/icon48.png icons/icon128.png; do
  if [[ ! -f "$EXT_DIR/$f" ]]; then
    echo "❌ Missing required file: $f"
    exit 1
  fi
done

echo "📦 Packaging Popouts for Chrome Web Store..."
echo "   Source: $EXT_DIR"
echo "   Output: $OUTPUT_ZIP"
echo ""

# Remove old zip if present
rm -f "$OUTPUT_ZIP"

cd "$EXT_DIR"
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

echo ""
echo "✅ Done! Created: $OUTPUT_ZIP"
echo ""
echo "📤 Next steps:"
echo "   1. Go to https://chrome.google.com/webstore/devconsole"
echo "   2. Click 'New Item' and upload $OUTPUT_ZIP"
echo "   3. Fill in the store listing (screenshots, description, etc.)"
echo "   4. In Privacy practices, add: https://www.popouts.app/privacy.html"
echo "   5. Submit for review"
echo ""
