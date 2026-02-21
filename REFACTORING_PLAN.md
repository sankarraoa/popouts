# Code Modularization Plan

## Current State
- `sidepanel/sidepanel.js`: ~1981 lines - Contains all UI logic
- `js/`: Contains data layer modules (db.js, meetings.js, agenda.js, notes.js, actions.js)

## Proposed Modular Structure

### New Module Files (in `js/modules/`)

1. **`state.js`** ✅ Created
   - Shared state object
   - `saveState()` and `restoreState()` functions
   - State persistence logic

2. **`sidebar.js`** (To be created)
   - Category toggle functionality
   - Meeting list rendering
   - Add meeting input handling
   - Meeting item creation and deletion

3. **`agenda-tab.js`** (To be created)
   - `loadAgenda()` function
   - `createAgendaItemElement()` function
   - Agenda filter handling
   - Agenda input handling

4. **`notes-tab.js`** (To be created)
   - `loadNotes()` function
   - `createDateCard()` function
   - `createNoteRow()` function
   - `createNoteInputRow()` function
   - Notes editing logic

5. **`actions-tab.js`** (To be created)
   - `loadActions()` function (meeting-specific)
   - `createActionItemElement()` function
   - Action filter handling
   - Action input handling

6. **`consolidated-actions.js`** (To be created)
   - `loadConsolidatedActions()` function
   - Consolidated actions view logic
   - Add action section handling
   - Search functionality

7. **`meeting-view.js`** (To be created)
   - `selectMeeting()` function
   - `switchView()` function
   - Meeting detail view coordination

8. **`utils.js`** (To be created)
   - `formatDate()` function
   - `formatLastDate()` function
   - `formatNoteDate()` function
   - `isToday()` function
   - `updateCounts()` function

### Refactored Main File

**`sidepanel/sidepanel.js`** (Will become ~200-300 lines)
- Main initialization (`init()`)
- DOM element initialization (`initializeElements()`)
- Event listener setup coordination
- Module imports and coordination

## Implementation Approach

1. **Phase 1**: Create utility modules (state.js, utils.js) ✅
2. **Phase 2**: Extract sidebar functionality
3. **Phase 3**: Extract tab modules (agenda, notes, actions)
4. **Phase 4**: Extract consolidated actions
5. **Phase 5**: Extract meeting view coordination
6. **Phase 6**: Refactor main sidepanel.js to be coordinator
7. **Phase 7**: Update HTML to use ES6 modules

## Benefits

- **Maintainability**: Each module has a single responsibility
- **Testability**: Modules can be tested independently
- **Readability**: Smaller, focused files are easier to understand
- **Collaboration**: Multiple developers can work on different modules
- **Reusability**: Modules can be reused or replaced easily

## Migration Strategy

- Use ES6 modules (`import`/`export`)
- Update HTML script tags to `type="module"`
- Maintain backward compatibility during transition
- Test each module extraction incrementally
