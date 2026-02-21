# Quick Start - Testing in Chrome

## Step 1: Load the Extension

1. **Open Chrome Extensions Page**
   - Open Google Chrome
   - Type `chrome://extensions/` in the address bar and press Enter
   - OR go to: Menu (⋮) → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner
   - It should turn blue/on

3. **Load the Extension**
   - Click the "Load unpacked" button (top-left)
   - Navigate to and select the `chrome-extension` folder:
     ```
     /Users/sankar.amburkar/VSCode/meetingNotes/chrome-extension
     ```
   - Click "Select" or "Open"

4. **Verify Installation**
   - You should see "Popouts" appear in your extensions list
   - If there are any errors (red text), check the console (see troubleshooting below)

## Step 2: Open the Extension

**Option A: Via Extension Icon**
1. Look for the extension icon in Chrome's toolbar (top-right)
2. Click it to open the popup
3. Click "Open Popouts" button
4. The side panel should open on the right side of your browser

**Option B: Via Side Panel Directly**
1. Right-click the extension icon
2. Select "Open side panel" (if available)
3. OR use the keyboard shortcut (if configured)

**Option C: Via Extension Menu**
1. Click the puzzle piece icon (extensions menu) in Chrome toolbar
2. Find "Popouts"
3. Click the three dots (⋮) next to it
4. Select "Open side panel"

## Step 3: Test Basic Functionality

### Test 1: Create a Meeting
1. In the side panel, find the "1:1s" section
2. Click the "+ Add" button next to it
3. A modal should appear
4. Type "1:1 with Alex" in the input field
5. Click "Add Meeting"
6. ✅ You should see "1:1 with Alex" appear in the 1:1s list

### Test 2: Select a Meeting
1. Click on "1:1 with Alex" in the sidebar
2. ✅ The meeting should highlight (gray background)
3. ✅ The main panel should show meeting details
4. ✅ You should see "Agenda", "Notes", and "Actions" tabs

### Test 3: Add an Agenda Item
1. Make sure you're on the "Agenda" tab (should be active by default)
2. Click in the input field that says "Type an agenda item, press Enter..."
3. Type "Review Q1 goals progress"
4. Press Enter
5. ✅ The agenda item should appear below with a checkbox
6. ✅ The agenda count badge should update

### Test 4: Toggle Agenda Item
1. Click the checkbox next to an agenda item
2. ✅ The item should show as closed (strikethrough text, grayed out)
3. Click the checkbox again
4. ✅ The item should reopen (normal text)

### Test 5: Filter Agenda Items
1. Click the "Open" filter button
2. ✅ Should only show open items
3. Click "All" filter
4. ✅ Should show all items again

### Test 6: Add Notes
1. Click the "Notes" tab
2. Type some notes in the textarea
3. Click away or click another tab
4. ✅ Notes should auto-save
5. Click back to "Notes" tab
6. ✅ Your notes should still be there

### Test 7: Create Multiple Meetings
1. Create a meeting in "Recurring" category
2. Create a meeting in "Ad Hoc" category
3. ✅ Category counts should update
4. ✅ Meetings should appear in correct categories

## Troubleshooting

### Extension Won't Load

**Error: "Manifest file is missing or unreadable"**
- Make sure you selected the `chrome-extension` folder (not the parent folder)
- Check that `manifest.json` exists in the `chrome-extension` folder

**Error: "Service worker registration failed"**
- Check that `background/service-worker.js` exists
- Open DevTools (see below) and check for JavaScript errors

### Extension Loads But Side Panel Won't Open

**Side panel is blank or shows error**
1. Right-click the extension icon → "Inspect popup" (or side panel)
2. Open Chrome DevTools (F12 or Cmd+Option+I on Mac)
3. Check the Console tab for errors
4. Common issues:
   - Dexie.js not loading (check Network tab)
   - JavaScript syntax errors
   - Missing files

### Data Not Saving

1. Open Chrome DevTools (F12)
2. Go to **Application** tab
3. Expand **IndexedDB** in the left sidebar
4. Click **MeetingNotesDB** (database name kept for backward compatibility)
5. ✅ You should see tables: `meetingSeries`, `meetingInstances`, `agendaItems`, `actionItems`
6. If tables are empty, check console for database errors

### Dexie.js Not Loading

**Check Network Tab:**
1. Open DevTools (F12)
2. Go to **Network** tab
3. Reload the side panel
4. Look for `dexie.min.js` request
5. If it fails (red), check:
   - Internet connection (needed for first load)
   - Content Security Policy in manifest.json

**Alternative: Use Local Dexie**
If CDN doesn't work, you can download Dexie.js locally:
```bash
cd /Users/sankar.amburkar/VSCode/meetingNotes
curl -L https://unpkg.com/dexie@latest/dist/dexie.min.js -o lib/dexie.min.js
```
Then update `sidepanel.html` to use:
```html
<script src="../lib/dexie.min.js"></script>
```
instead of the CDN URL.

## Viewing Extension Logs

**Side Panel Console:**
1. Right-click in the side panel
2. Select "Inspect" or "Inspect element"
3. DevTools opens with Console tab
4. Look for errors or `console.log` messages

**Background Service Worker:**
1. Go to `chrome://extensions/`
2. Find "Popouts"
3. Click "service worker" link (under "Inspect views")
4. Console opens for background script

## Reloading After Changes

After making code changes:
1. Go to `chrome://extensions/`
2. Find "Popouts"
3. Click the refresh icon (🔄) next to it
4. Reload the side panel (close and reopen)

## Next Steps

Once basic testing works:
- See `TESTING.md` for comprehensive test cases
- Check `README.md` for feature documentation
- Start building the next page (Notes detail, Actions detail, etc.)
