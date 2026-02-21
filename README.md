# Popouts Chrome Extension

A Chrome extension for productivity tools that pop out of your browser - like digital post-its. Start with meeting notes, expand to whatever you need.

**Repository**: [https://github.com/sankarraoa/popouts.git](https://github.com/sankarraoa/popouts.git)

## Features

- **Meeting Management**: Organize meetings by type (1:1s, Recurring, Ad Hoc)
- **Running Agendas**: Add agenda items that carry forward across meeting instances
- **Free-form Notes**: Take notes during any meeting
- **Action Tracking**: Track action items (manual for now, LLM extraction coming soon)
- **100% Local**: All data stored locally in your browser using IndexedDB

## Installation

### Development Setup

1. **Clone or navigate to this directory**
   ```bash
   cd meetingNotes
   ```

2. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `meetingNotes` directory

3. **Access the extension**
   - Click the extension icon in the toolbar to open the popup
   - Or click "Open Meeting Notes" to open the side panel
   - The side panel is the main interface

## Project Structure

```
meetingNotes/
├── manifest.json          # Chrome Extension manifest
├── sidepanel/             # Main UI (side panel)
│   ├── sidepanel.html
│   ├── sidepanel.css
│   └── sidepanel.js
├── popup/                  # Quick access popup
│   ├── popup.html
│   └── popup.js
├── background/             # Service worker
│   └── service-worker.js
├── js/                     # Core logic
│   ├── db.js              # Database setup (Dexie.js)
│   ├── meetings.js        # Meeting series & instances
│   ├── agenda.js          # Agenda items
│   └── actions.js         # Action items
├── icons/                  # Extension icons
└── README.md
```

## Usage

### Creating a Meeting

1. Click the "+ Add" button next to any category (1:1s, Recurring, Ad Hoc)
2. Enter a meeting name (e.g., "1:1 with Alex")
3. Click "Add Meeting"

### Adding Agenda Items

1. Select a meeting from the sidebar
2. Go to the "Agenda" tab
3. Type an agenda item and press Enter
4. Agenda items carry forward across meeting instances

### Taking Notes

1. Select a meeting
2. Go to the "Notes" tab
3. Type your free-form notes
4. Notes are auto-saved when you click away

### Managing Actions

1. Select a meeting
2. Go to the "Actions" tab
3. View action items (manual creation coming soon)

## Development

### Tech Stack

- **Vanilla JavaScript** - No frameworks, just plain JS
- **Dexie.js** - IndexedDB wrapper (loaded from CDN)
- **Chrome Extension Manifest V3**

### Data Storage

All data is stored locally using IndexedDB:
- `meetingSeries` - Meeting series (1:1s, recurring, ad hoc)
- `meetingInstances` - Individual meeting occurrences
- `agendaItems` - Running agenda items
- `actionItems` - Action items extracted from notes

### Next Steps

- [ ] Add LLM integration for automatic action extraction
- [ ] Improve icon design
- [ ] Add meeting instance creation UI
- [ ] Add action item creation UI
- [ ] Add export functionality

## Notes

- The extension uses Dexie.js loaded from CDN (unpkg.com)
- All data is stored locally - no server required
- The extension works offline once loaded

## License

MIT
