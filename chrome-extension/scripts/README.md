# Popouts Demo Data

Fictious data for a busy Silicon Valley executive: 1:1s, recurring project reviews, leadership meetings, new project kickoffs, conflict resolution, unblocking, and prioritization.

## seed-demo-data.json

Demo data for video recording and import testing. Matches the Popouts export format.

### How to import

1. Open the Popouts extension (popup or sidepanel)
2. Go to **Settings** (gear icon)
3. Click the **Import** button (or document-with-arrow icon)
4. Select `seed-demo-data.json`

### What's included

| Meeting | Type | Description |
|---------|------|-------------|
| 1:1 with Jordan Chen | 1:1s | Engineering lead – infra migration, career growth |
| 1:1 with Maya Patel | 1:1s | Product – checkout redesign, PM rotation |
| 1:1 with David Okonkwo | 1:1s | Data Science – ML pipeline, churn prediction |
| Weekly Product Review | Recurring | Search v2, mobile app, Q2 roadmap |
| Staff Sync | Recurring | Headcount, hiring, team morale |
| Board Prep – Q2 Strategy | Recurring | Q1 results, international expansion |
| Flux AI Integration Kickoff | Ad Hoc | New project – white-label vs co-branded |
| Design vs PM Conflict Resolution | Ad Hoc | Onboarding flow A/B test |
| Platform Unblock Session | Ad Hoc | CDN migration, API gateway |
| Q2 Priorities Alignment | Ad Hoc | Reprioritization, stakeholder comms |

### For video recording

See **[RECORDING_SCRIPT.md](RECORDING_SCRIPT.md)** for the full ~2 min demo script, including:
- Pre-recording setup (import this JSON)
- Flow: Enter agenda → Enter two notes (one → 2 action items, one observation only) → View actions → Consolidated view → Search
- Sample notes: one that produces 2 action items, one that is an observation (no actions)

### For import testing

The file uses the same schema as Popouts export. Import adds data to existing data (does not clear first). To test a clean import, export your current data as backup, clear via Settings if needed, then import this file.

## seed-demo-data.js

Console script that seeds the same data directly into IndexedDB. Useful when you want to clear and reseed without importing.

### How to run

1. Open the Popouts extension (popup or sidepanel)
2. Right-click inside it → **Inspect**
3. Go to the **Console** tab
4. Copy-paste the entire `seed-demo-data.js` file and press Enter
