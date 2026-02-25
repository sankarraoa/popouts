#!/bin/bash
# Package the Popouts Chrome extension for sharing with friends and family
# Creates a ZIP file that recipients can unzip and load as "Load unpacked"

set -e

EXT_DIR="$(cd "$(dirname "$0")" && pwd)"
RELEASE_DIR="$EXT_DIR/release"
ZIP_NAME="Popouts-extension.zip"

# Files/folders to exclude from the package (dev-only, not needed for the extension)
EXCLUDE=(
  "*.md"
  "*.json"
  "node_modules"
  ".git"
  ".DS_Store"
  "release"
  "*.pem"
  "package-extension.sh"
  "restore-data.js"
  "backup-data.js"
  "generate-icons.html"
  "generate-icons.js"
  "generate-category-icons.html"
  "create_icons.html"
  "ICON_*.md"
  "README.md"
)

echo "📦 Packaging Popouts extension..."
echo "   Source: $EXT_DIR"
echo "   Output: $RELEASE_DIR/$ZIP_NAME"
echo ""

# Create release directory
mkdir -p "$RELEASE_DIR"
cd "$EXT_DIR"
zip -r "$RELEASE_DIR/$ZIP_NAME" . \
  -x "*.md" \
  -x "node_modules/*" \
  -x ".git/*" \
  -x "release/*" \
  -x "*.pem" \
  -x "package-extension.sh" \
  -x "restore-data.js" \
  -x "backup-data.js" \
  -x "icons/generate-icons.html" \
  -x "icons/generate-icons.js" \
  -x "icons/generate-category-icons.html" \
  -x "icons/create_icons.html" \
  -x "icons/ICON_*.md" \
  -x "icons/README.md" \
  -x "js/modules/README.md" \
  -x "BACKUP_INSTRUCTIONS.md" \
  -x "*.DS_Store"

echo "✅ Done! Created: $RELEASE_DIR/$ZIP_NAME"
echo ""
echo "📤 Share this file with friends and family."
echo ""
echo "📋 Installation instructions for recipients:"
echo "   1. Download the ZIP file"
echo "   2. Unzip it to a folder (e.g. Desktop/Popouts)"
echo "   3. Open Chrome and go to chrome://extensions"
echo "   4. Turn ON 'Developer mode' (top right)"
echo "   5. Click 'Load unpacked'"
echo "   6. Select the unzipped folder"
echo ""
