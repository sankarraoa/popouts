# Testing Guide

## Quick Start

1. **Load the extension in Chrome**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `meetingNotes` folder

2. **Open the extension**
   - Click the extension icon → "Open Popouts"
   - Or right-click the icon → "Open side panel"

## Testing the Home Page

### 1. Create a Meeting
- Click "+ Add" next to "1:1s"
- Enter "1:1 with Alex"
- Click "Add Meeting"
- ✅ Should see the meeting appear in the sidebar

### 2. Select a Meeting
- Click on "1:1 with Alex" in the sidebar
- ✅ Should see meeting detail panel open
- ✅ Should show "Agenda", "Notes", "Actions" tabs

### 3. Add Agenda Items
- Make sure "Agenda" tab is selected
- Type "Review Q1 goals" and press Enter
- ✅ Should see the agenda item appear
- ✅ Checkbox should be unchecked (open)

### 4. Toggle Agenda Item
- Click the checkbox next to an agenda item
- ✅ Item should show as closed (strikethrough)
- ✅ Click again to reopen

### 5. Filter Agenda Items
- Click "Open" filter
- ✅ Should only show open items
- Click "All" filter
- ✅ Should show all items

### 6. Add Notes
- Click "Notes" tab
- Type some notes
- Click away (blur)
- ✅ Notes should be saved
- Reload the extension
- ✅ Notes should persist

### 7. Create Multiple Meetings
- Create meetings in different categories (1:1s, Recurring, Ad Hoc)
- ✅ Should see counts update in category headers
- ✅ Should see meetings grouped correctly

### 8. Meeting Stats
- Check sidebar meeting items
- ✅ Should show "X open" badges for agenda items
- ✅ Should show "X notes" count
- ✅ Should show last meeting date

## Known Issues / TODO

- Icons are placeholders (need actual PNG files)
- Action items view is basic (no creation UI yet)
- Notes count in header not yet implemented
- Category collapse/expand animation not implemented

## Data Persistence

All data is stored in IndexedDB. To verify:
1. Open Chrome DevTools (F12)
2. Go to Application tab
3. Check IndexedDB → MeetingNotesDB
4. Should see tables: meetingSeries, meetingInstances, agendaItems, actionItems

## Troubleshooting

**Extension won't load:**
- Check manifest.json syntax
- Check console for errors (F12)

**Dexie.js not loading:**
- Check network tab for CDN request
- Verify `content_security_policy` in manifest.json

**Data not persisting:**
- Check IndexedDB in DevTools
- Check console for database errors
