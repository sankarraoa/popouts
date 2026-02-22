// Meeting series and instances management
import { db } from './db.js';

const MeetingType = {
  ONE_ON_ONE: '1:1s',
  RECURRING: 'recurring',
  ADHOC: 'adhoc'
};

// Create a new meeting series
export async function createMeetingSeries(name, type) {
  const id = await db.meetingSeries.add({
    name,
    type,
    createdAt: new Date()
  });
  return id;
}

// Get all meeting series
export async function getAllMeetingSeries() {
  await db.ensureReady();
  return await db.meetingSeries.toArray();
}

// Get meeting series by type
async function getMeetingSeriesByType(type) {
  return await db.meetingSeries.where('type').equals(type).toArray();
}

// Get a single meeting series
export async function getMeetingSeries(id) {
  return await db.meetingSeries.get(id);
}

// Update meeting series
async function updateMeetingSeries(id, updates) {
  await db.meetingSeries.update(id, updates);
}

// Delete meeting series
export async function deleteMeetingSeries(id) {
  await db.meetingSeries.delete(id);
  // Also delete related instances, agenda items, and actions
  await db.meetingInstances.where('seriesId').equals(id).delete();
  await db.agendaItems.where('seriesId').equals(id).delete();
  await db.actionItems.where('seriesId').equals(id).delete();
}

// Create a meeting instance
async function createMeetingInstance(seriesId, date = new Date()) {
  const id = await db.meetingInstances.add({
    seriesId,
    date,
    notes: '',
    extractedAt: null
  });
  return id;
}

// Get all instances for a meeting series
async function getMeetingInstances(seriesId) {
  return await db.meetingInstances
    .where('seriesId')
    .equals(seriesId)
    .sortBy('date');
}

// Get the latest instance for a meeting series
export async function getLatestMeetingInstance(seriesId) {
  const instances = await getMeetingInstances(seriesId);
  return instances.length > 0 ? instances[instances.length - 1] : null;
}

// Update meeting instance
async function updateMeetingInstance(id, updates) {
  await db.meetingInstances.update(id, updates);
}

// Get meeting stats (for display in sidebar)
export async function getMeetingStats(seriesId) {
  const [instances, agendaItems, actionItems] = await Promise.all([
    getMeetingInstances(seriesId),
    db.agendaItems.where('seriesId').equals(seriesId).toArray(),
    db.actionItems.where('seriesId').equals(seriesId).toArray()
  ]);

  const openAgendaItems = agendaItems.filter(item => item.status === 'open').length;
  const openActionItems = actionItems.filter(item => item.status === 'open').length;

  // Calculate lastDate based on most recent activity:
  // - Agenda items: createdAt and closedAt
  // - Notes: createdAt and updatedAt from meeting instances
  // - Action items: createdAt and closedAt
  const allDates = [];
  
  // Add agenda item dates
  agendaItems.forEach(item => {
    if (item.createdAt) allDates.push(new Date(item.createdAt));
    if (item.closedAt) allDates.push(new Date(item.closedAt));
  });
  
  // Add note dates from instances
  instances.forEach(instance => {
    if (instance.notes && Array.isArray(instance.notes)) {
      instance.notes.forEach(note => {
        if (note.createdAt) allDates.push(new Date(note.createdAt));
        if (note.updatedAt) allDates.push(new Date(note.updatedAt));
      });
    }
  });
  
  // Add action item dates
  actionItems.forEach(item => {
    if (item.createdAt) allDates.push(new Date(item.createdAt));
    if (item.closedAt) allDates.push(new Date(item.closedAt));
  });
  
  // Find the most recent date
  const lastDate = allDates.length > 0 
    ? new Date(Math.max(...allDates.map(d => d.getTime())))
    : null;

  return {
    noteCount: instances.length,
    openAgendaCount: openAgendaItems,
    openActionCount: openActionItems,
    lastDate
  };
}
