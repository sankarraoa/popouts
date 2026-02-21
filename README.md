# Popouts

A productivity tool that pops out of your browser - like digital post-its. Start with meeting notes, expand to whatever you need.

**Repository**: [https://github.com/sankarraoa/popouts.git](https://github.com/sankarraoa/popouts.git)

## Features

- **Meeting Management**: Organize meetings by type (1:1s, Recurring, Ad Hoc)
- **Running Agendas**: Add agenda items that carry forward across meeting instances
- **Free-form Notes**: Take notes during any meeting
- **Action Tracking**: Track action items (manual for now, LLM extraction coming soon)
- **100% Local**: All data stored locally in your browser using IndexedDB

## Project Structure

```
popouts/
├── chrome-extension/      # Chrome Extension (current)
│   ├── manifest.json
│   ├── sidepanel/
│   ├── popup/
│   ├── background/
│   ├── js/
│   ├── lib/
│   └── icons/
├── server/                # Server-side API (future)
│   ├── api/
│   │   ├── llm/          # LLM integration
│   │   └── backup/       # Backup & sync
│   └── server.js
├── shared/                # Shared code
│   ├── constants.js
│   └── types.js
├── safari-extension/       # Safari Extension (future)
├── mobile-app/            # Mobile App (future)
└── README.md
```

## Installation

### Chrome Extension

1. **Clone the repository**
   ```bash
   git clone https://github.com/sankarraoa/popouts.git
   cd popouts
   ```

2. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `chrome-extension` directory

3. **Access the extension**
   - Click the extension icon in the toolbar to open the popup
   - Or click "Open Popouts" to open the side panel
   - The side panel is the main interface

See [chrome-extension/README.md](chrome-extension/README.md) for more details.

## Usage

### Creating a Meeting

1. Click the "+ Add" button next to any category (1:1s, Recurring, Ad Hoc)
2. Enter a meeting name (e.g., "1:1 with Alex")
3. Press Enter to add

### Adding Agenda Items

1. Select a meeting from the sidebar
2. Go to the "Agenda" tab
3. Type an agenda item and press Enter
4. Agenda items carry forward across meeting instances

### Taking Notes

1. Select a meeting
2. Go to the "Notes" tab
3. Type your free-form notes
4. Notes are auto-saved

### Managing Actions

1. Select a meeting
2. Go to the "Actions" tab
3. Add action items or view consolidated actions

## Development

### Tech Stack

- **Vanilla JavaScript** - No frameworks, just plain JS
- **Dexie.js** - IndexedDB wrapper
- **Chrome Extension Manifest V3**

### Data Storage

All data is stored locally using IndexedDB:
- `meetingSeries` - Meeting series (1:1s, recurring, ad hoc)
- `meetingInstances` - Individual meeting occurrences
- `agendaItems` - Running agenda items
- `actionItems` - Action items

### Future Platforms

- **Safari Extension**: Planned in `safari-extension/` folder
- **Mobile App**: Planned in `mobile-app/` folder
- **Web App**: Planned in `web-app/` folder

## Next Steps

- [ ] Add LLM integration for automatic action extraction
- [ ] Cloud backup and sync
- [ ] Safari extension
- [ ] Mobile app
- [ ] Multi-device synchronization

## License

MIT
