# Sharing Popouts with Friends & Family

## Quick method: ZIP file (recommended)

Run the packaging script:

```bash
cd chrome-extension
chmod +x package-extension.sh
./package-extension.sh
```

This creates `release/Popouts-extension.zip`. Share that file!

### Instructions to send to recipients

> **How to install Popouts**
>
> 1. Download the ZIP file I sent you
> 2. Unzip it (double-click or right-click → Extract) to a folder (e.g. Desktop)
> 3. Open Google Chrome
> 4. Go to `chrome://extensions`
> 5. Turn **ON** "Developer mode" (toggle in the top-right corner)
> 6. Click **"Load unpacked"**
> 7. Select the folder you unzipped (the one containing `manifest.json`)
> 8. Done! The Popouts icon should appear in your Chrome toolbar

---

## Alternative: CRX file

Chrome can create a `.crx` file, but **installing CRX files from outside the Chrome Web Store is often blocked** by Chrome for security. The ZIP + Load unpacked method above is more reliable.

If you still want a CRX:

1. Load your extension in Chrome (Load unpacked)
2. Go to `chrome://extensions`
3. Ensure "Developer mode" is ON
4. Click **"Pack extension"**
5. Choose the extension root folder (the `chrome-extension` folder)
6. Leave "Private key file" empty the first time (Chrome creates a `.pem` file)
7. Chrome creates `chrome-extension.crx` and `chrome-extension.pem`

**Important:** Keep the `.pem` file private! You need it to create updated CRX files later. Recipients may need to enable "Allow extensions from other websites" in Chrome flags, and installation can still be blocked.

---

## Before sharing: ensure icons exist

The extension needs `icon16.png`, `icon48.png`, and `icon128.png` in the `icons/` folder. If they're missing:

1. Open `icons/generate-icons.html` in a browser
2. Click "Generate Icons"
3. Move the downloaded PNGs into the `icons/` folder
