# Icon Generation Instructions

The extension needs PNG icon files at 16x16, 48x48, and 128x128 pixels.

## Quick Method (Recommended)

1. Open `icons/create_icons.html` in your browser
2. The page will automatically download the three PNG files
3. Save them as:
   - `icon16.png`
   - `icon48.png`
   - `icon128.png`
   - In the `icons/` folder

## Alternative Method

If the HTML method doesn't work, you can:

1. Use an online SVG to PNG converter:
   - Go to https://convertio.co/svg-png/ or similar
   - Upload `icons/icon.svg`
   - Convert to PNG at sizes: 16x16, 48x48, 128x128
   - Download and save as `icon16.png`, `icon48.png`, `icon128.png`

2. Or use ImageMagick (if installed):
   ```bash
   cd icons
   convert -background none -resize 16x16 icon.svg icon16.png
   convert -background none -resize 48x48 icon.svg icon48.png
   convert -background none -resize 128x128 icon.svg icon128.png
   ```

The SVG icons are already integrated into the UI (header logo and tab icons), so those will work immediately. The PNG files are only needed for the Chrome extension icon in the toolbar.
