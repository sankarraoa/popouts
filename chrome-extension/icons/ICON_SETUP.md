# Setting Up Extension Icons

The extension needs PNG icon files at 16x16, 48x48, and 128x128 pixels.

## Quick Method (Recommended)

1. **Open the icon generator:**
   - Open `icons/generate-icons.html` in your browser
   - Click "Generate Icons" button
   - The files will automatically download

2. **Move the files:**
   - Move the downloaded files (`icon16.png`, `icon48.png`, `icon128.png`) to the `icons/` folder
   - Replace the existing placeholder files

3. **Reload the extension:**
   - Go to `chrome://extensions/`
   - Click the refresh icon on "Popouts"
   - The new icon should appear in your toolbar

## Alternative: Manual Conversion

If the HTML generator doesn't work:

1. **Use an online converter:**
   - Go to https://convertio.co/svg-png/ or https://cloudconvert.com/svg-to-png
   - Upload `icons/icon.svg`
   - Convert to PNG at sizes: 16x16, 48x48, 128x128
   - Download and save as `icon16.png`, `icon48.png`, `icon128.png` in the `icons/` folder

2. **Or use ImageMagick (if installed):**
   ```bash
   cd icons
   convert -background none -resize 16x16 icon.svg icon16.png
   convert -background none -resize 48x48 icon.svg icon48.png
   convert -background none -resize 128x128 icon.svg icon128.png
   ```

## Icon Design

The icon is a dark rounded square (#030213) with a white notebook/spiral-bound notepad icon in the center, matching the logo in the header.
