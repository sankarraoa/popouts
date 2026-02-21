// Notes management - multiple notes per instance
import { db } from './db.js';

// Add a note to an instance (or create instance if it doesn't exist)
export async function addNote(seriesId, noteText, date = new Date()) {
  // Normalize date to start of day for grouping
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  
  // Find or create instance for this date
  const instances = await db.meetingInstances
    .where('seriesId')
    .equals(seriesId)
    .toArray();
  
  let instance = instances.find(inst => {
    const instDate = new Date(inst.date);
    instDate.setHours(0, 0, 0, 0);
    return instDate.getTime() === normalizedDate.getTime();
  });
  
  if (!instance) {
    // Create new instance for this date
    const instanceId = await db.meetingInstances.add({
      seriesId,
      date: normalizedDate,
      notes: [],
      extractedAt: null
    });
    instance = await db.meetingInstances.get(instanceId);
  }
  
  // Add note to array
  const notes = Array.isArray(instance.notes) ? instance.notes : (instance.notes ? [instance.notes] : []);
  notes.push({
    text: noteText,
    createdAt: new Date()
  });
  
  await db.meetingInstances.update(instance.id, {
    notes: notes
  });
  
  return instance.id;
}

// Update a specific note in an instance
export async function updateNote(seriesId, noteIndex, noteText, date = new Date()) {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  
  const instances = await db.meetingInstances
    .where('seriesId')
    .equals(seriesId)
    .toArray();
  
  const instance = instances.find(inst => {
    const instDate = new Date(inst.date);
    instDate.setHours(0, 0, 0, 0);
    return instDate.getTime() === normalizedDate.getTime();
  });
  
  if (instance && Array.isArray(instance.notes) && instance.notes[noteIndex]) {
    const notes = [...instance.notes];
    notes[noteIndex] = {
      ...notes[noteIndex],
      text: noteText,
      updatedAt: new Date()
    };
    
    await db.meetingInstances.update(instance.id, {
      notes: notes
    });
  }
}

// Get all instances with notes for a meeting series, grouped by date
export async function getNotesByDate(seriesId) {
  const instances = await db.meetingInstances
    .where('seriesId')
    .equals(seriesId)
    .toArray();
  
  // Group by date and convert notes to array format
  const notesByDate = {};
  
  instances.forEach(instance => {
    const date = new Date(instance.date);
    date.setHours(0, 0, 0, 0);
    const dateKey = date.toISOString();
    
    // Convert notes to array format if needed
    let notes = [];
    if (Array.isArray(instance.notes)) {
      notes = instance.notes;
    } else if (instance.notes && typeof instance.notes === 'string' && instance.notes.trim()) {
      // Migrate old string format to array
      notes = [{ text: instance.notes, createdAt: date }];
    }
    
    if (!notesByDate[dateKey]) {
      notesByDate[dateKey] = {
        date: date,
        instanceId: instance.id,
        notes: notes
      };
    } else {
      // Merge notes if multiple instances exist for same date
      notesByDate[dateKey].notes = [...notesByDate[dateKey].notes, ...notes];
    }
  });
  
  // Convert to array, filter out empty notes, and sort by date (newest first)
  return Object.values(notesByDate)
    .filter(dateGroup => dateGroup.notes && dateGroup.notes.length > 0)
    .sort((a, b) => b.date - a.date);
}

// Check if a date is today
function isToday(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate.getTime() === today.getTime();
}

// Format date for display
function formatNoteDate(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const noteDate = new Date(date);
  noteDate.setHours(0, 0, 0, 0);
  
  if (noteDate.getTime() === today.getTime()) {
    return 'Today';
  }
  
  const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  return noteDate.toLocaleDateString('en-US', options);
}
