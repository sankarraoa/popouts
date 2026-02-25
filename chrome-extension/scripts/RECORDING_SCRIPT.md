# Popouts Demo Recording Script

Demo flow: Enter agenda → Enter two notes (one → 2 action items, one observation only) → View actions → Consolidated view → Search for the recent one.

---

## Before Recording

1. **Import seed data**
   - Open Popouts (popup or sidepanel)
   - Go to **Settings** (gear icon)
   - Click **Import**
   - Select `seed-demo-data.json`
   - Confirm success message

2. **Optional: Clear existing data first**
   - If you have old data, use Settings → Clear (or export as backup, then clear)
   - Then import `seed-demo-data.json`

---

## Recording Flow

### 1. Enter an Agenda (0:00–0:20)

- Open **1:1 with Jordan Chen** (or Maya / David)
- Ensure the **Agenda** tab is selected
- Show existing agenda items (e.g. "Infra migration blockers", "Career growth – architect path")
- Add a new agenda item live: *"Review Q3 planning timeline"*
- Press Enter to add it

### 2. Enter Notes (0:20–0:45)

- Switch to the **Notes** tab
- Show existing notes (e.g. Jordan’s infra migration, career growth)
- **Note 1 (action items):** Add a note that produces **two** action items. Type:

  > Jordan will follow up with Sarah in InfoSec on the security sign-off by Friday. He should share the timeline with the eng team by EOD.

- Save the note (blur or click away)
- Briefly show the **AI extraction** state (spinner / "Extracting…")
- Wait for the note to be marked as extracted and the two action items to appear

- **Note 2 (observation):** Add a second note that is **just an observation** (no action items). Type:

  > Jordan mentioned the team morale has improved since the reorg. The design system migration is on track for Q2.

- Save the note (blur or click away)
- The AI should extract **no action items** from this note – it stays as an observation only

### 3. Note → Two Action Items vs Observation (0:55–1:10)

- Point out the difference:
  - **First note** → 2 action items extracted
  - **Second note** → no action items (observation only)

### 4. View the Action Items (1:10–1:25)

- Switch to the **Actions** tab (within the meeting)
- Show the new action items for this meeting
- Point out open vs closed items
- Optionally toggle one to closed (checkmark) to show status change

### 5. Navigate to Consolidated Action Items (1:25–1:40)

- Click the top-level **Actions** tab in the header (next to "Meetings")
- The **Consolidated Action Items** view opens – all actions from all meetings
- Show the filters: All, Open, Closed
- Click **Open** to show only open action items

### 6. View Open Items and Search for the Recent One (1:40–2:00)

- With **Open** filter active, show the list of open action items
- Use the **Search actions...** box
- Type a distinctive word from the note you just added, e.g.:
  - *"Sarah"* or *"InfoSec"* or *"Slack"* or *"cutover"*
- The recently created action items appear in the filtered results
- Show that you can quickly find the new actions across all meetings

### 7. Wrap (2:00–2:10)

- End on the main value: *Agenda → Notes → AI extracts actions from actionable notes, ignores observations → View by meeting or consolidated → Search to find what you need*

---

## Sample Notes

**Note 1 (→ 2 action items):**

> Jordan will follow up with Sarah in InfoSec on the security sign-off by Friday. He should share the timeline with the eng team by EOD.

**Expected extracted actions:**
1. Jordan to follow up with Sarah in InfoSec on security sign-off by Friday
2. Share the timeline with the eng team by EOD

---

**Note 2 (observation only, no action items):**

> Jordan mentioned the team morale has improved since the reorg. The design system migration is on track for Q2.

**Expected:** No action items extracted – AI correctly treats this as an observation.

---

## Search Terms for Step 6

After adding Note 1, use any of these in the consolidated search to find the new actions:

| Search term | Matches |
|-------------|---------|
| Sarah | First action |
| InfoSec | First action |
| timeline | Second action |

---

## Tips

- Pre-populate with seed data so you only add 1 agenda item and 2 notes during recording.
- Keep the LLM service reachable so extraction completes during the demo.
- If extraction is slow, you can say "AI extracts actions in the background" and continue; the actions will appear when ready.
- Use a meeting with existing notes so the flow looks natural before you add the new ones.