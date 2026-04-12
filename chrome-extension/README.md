# Chrome Extension

Chrome extension implementation of Popouts.

## Structure

```
chrome-extension/
├── manifest.json          # Chrome Extension manifest
├── sidepanel/             # Main UI (side panel)
│   ├── sidepanel.html
│   ├── sidepanel.css
│   └── sidepanel.js
├── popup/                 # Quick access popup
│   └── popup.html
├── background/            # Service worker
│   └── service-worker.js
├── js/                    # Core logic
│   ├── db.js
│   ├── meetings.js
│   ├── agenda.js
│   ├── actions.js
│   ├── notes.js
│   └── modules/
├── lib/                   # Third-party libraries
│   └── dexie.min.js
└── icons/                 # Extension icons
```

## Installation

See the main [README.md](../README.md) for installation instructions.

## Development

1. Load the extension:
   - Open Chrome → `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `chrome-extension/` folder

2. Make changes and reload:
   - Click the refresh icon on the extension
   - Reload the side panel

## Chrome Web Store versioning

The extension version is **only** in `manifest.json` (`version`). There is no `package.json` in this folder; bump `version` for every upload to the store (each submission must be strictly higher than the last published build).

## Future: Other Platforms

- **Safari Extension**: Will be in `safari-extension/` folder
- **Mobile App**: Will be in `mobile-app/` folder
- **Web App**: Will be in `web-app/` folder
