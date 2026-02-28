// Database setup using Dexie.js
// Dexie is loaded globally from lib/dexie.min.js
// Access it from the global scope
const DexieClass = (typeof window !== 'undefined' && window.Dexie) || 
                   (typeof global !== 'undefined' && global.Dexie) ||
                   (typeof self !== 'undefined' && self.Dexie) ||
                   (typeof Dexie !== 'undefined' ? Dexie : null);

if (!DexieClass) {
  throw new Error('Dexie is not available. Make sure lib/dexie.min.js is loaded before this module.');
}

export const db = new DexieClass('MeetingNotesDB');

db.version(1).stores({
  meetingSeries: '++id, name, type, createdAt',
  meetingInstances: '++id, seriesId, date, notes, extractedAt',
  agendaItems: '++id, seriesId, text, status, createdAt, closedAt',
  actionItems: '++id, seriesId, instanceId, text, assignee, dueDate, status, createdAt, closedAt'
});

// Database will be initialized when ensureReady() is called
// No need to initialize here - let the main init() handle it
