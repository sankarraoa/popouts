#!/bin/bash
# Package Popouts Chrome extension for Chrome Web Store submission.
# Creates a ZIP file ready to upload at https://chrome.google.com/webstore/devconsole

set -e

EXT_DIR="$(cd "$(dirname "$0")" && pwd)"
RELEASE_DIR="$EXT_DIR/release"
TIMESTAMP="$(date +%d%b%Y-%H%M)"
OUTPUT_ZIP="$RELEASE_DIR/Popouts-chrome-store-$TIMESTAMP.zip"

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

mkdir -p "$RELEASE_DIR"
cd "$EXT_DIR"

# Create manifest without localhost for Chrome Web Store (production only)
cp manifest.json manifest.json.bak
node -e "
const fs = require('fs');
const m = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
m.host_permissions = m.host_permissions.filter(h => !h.startsWith('http://localhost'));
fs.writeFileSync('manifest.json', JSON.stringify(m));
"

# Create config.js without localhost for Chrome Web Store (development = production URLs)
cp js/config.js js/config.js.bak
node -e "
const fs = require('fs');
let c = fs.readFileSync('js/config.js', 'utf8');
c = c
  .replace(\"'http://localhost:8000'\", \"'https://llm-service-production-22b1.up.railway.app'\")
  .replace(\"'http://localhost:8001'\", \"'https://license-service-production.up.railway.app'\")
  .replace(\"'http://localhost:8080'\", \"'https://www.popouts.app'\");
fs.writeFileSync('js/config.js', c);
"

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
  -x "release/*" \
  -x "sidepanel/*" \
  -x "manifest.json.bak" \
  -x "js/config.js.bak" \
  -x "*.zip"

# Restore original files (with localhost for dev)
mv manifest.json.bak manifest.json
mv js/config.js.bak js/config.js

echo ""
echo "✅ Done! Created: $OUTPUT_ZIP"
echo ""
echo "📤 Chrome Web Store (updating an existing extension):"
echo "   1. Go to https://chrome.google.com/webstore/devconsole"
echo "   2. Open your existing Popouts item (do not use New Item unless it is a brand-new listing)."
echo "   3. Go to the Package tab → Upload a new package → select:"
echo "      $OUTPUT_ZIP"
echo "   4. Bump version in manifest.json if required, then Submit for review."
echo ""
echo "   First-time listing only: use New Item, then Privacy practices URL:"
echo "   https://www.popouts.app/privacy.html"
echo ""
echo "🚂 Railway: pushing to your connected branch redeploys the same service"
echo "   (a new deployment revision — not a second project)."
echo ""
