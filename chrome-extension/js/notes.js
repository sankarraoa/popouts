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
  const newNote = {
    text: noteText,
    createdAt: new Date(),
    actionStatus: 'not_actioned' // not_actioned, action_in_progress, action_completed, action_failed
  };
  console.log(`[Notes] Adding note with actionStatus: ${newNote.actionStatus}`, newNote);
  notes.push(newNote);
  
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
    const existingNote = notes[noteIndex];
    notes[noteIndex] = {
      ...existingNote,
      text: noteText,
      updatedAt: new Date(),
      // Reset action status if note text changed significantly (more than just whitespace)
      actionStatus: existingNote.text.trim() !== noteText.trim() ? 'not_actioned' : (existingNote.actionStatus || 'not_actioned')
    };
    
    await db.meetingInstances.update(instance.id, {
      notes: notes
    });
  }
}

// Delete a specific note from an instance
export async function deleteNote(seriesId, noteIndex, date = new Date()) {
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
    notes.splice(noteIndex, 1);
    
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
      notes = [{ text: instance.notes, createdAt: date, actionStatus: 'not_actioned' }];
    }
    
    // Ensure all notes have actionStatus
    notes = notes.map(note => ({
      ...note,
      actionStatus: note.actionStatus || 'not_actioned'
    }));
    
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
  
  // Convert to array, filter out empty notes, and sort by date
  // Order: Today first, Yesterday second, Day before yesterday third, then descending order
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dayBeforeYesterday = new Date(today);
  dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
  
  return Object.values(notesByDate)
    .filter(dateGroup => dateGroup.notes && dateGroup.notes.length > 0)
    .sort((a, b) => {
      const dateA = new Date(a.date);
      dateA.setHours(0, 0, 0, 0);
      const dateB = new Date(b.date);
      dateB.setHours(0, 0, 0, 0);
      
      const isTodayA = dateA.getTime() === today.getTime();
      const isTodayB = dateB.getTime() === today.getTime();
      const isYesterdayA = dateA.getTime() === yesterday.getTime();
      const isYesterdayB = dateB.getTime() === yesterday.getTime();
      const isDayBeforeYesterdayA = dateA.getTime() === dayBeforeYesterday.getTime();
      const isDayBeforeYesterdayB = dateB.getTime() === dayBeforeYesterday.getTime();
      
      // Today always comes first
      if (isTodayA && !isTodayB) return -1;
      if (!isTodayA && isTodayB) return 1;
      
      // Yesterday comes second (only if not Today)
      if (isYesterdayA && !isYesterdayB && !isTodayB) return -1;
      if (!isYesterdayA && isYesterdayB && !isTodayA) return 1;
      
      // Day before yesterday comes third (only if not Today or Yesterday)
      if (isDayBeforeYesterdayA && !isDayBeforeYesterdayB && !isTodayB && !isYesterdayB) return -1;
      if (!isDayBeforeYesterdayA && isDayBeforeYesterdayB && !isTodayA && !isYesterdayA) return 1;
      
      // For all other dates, sort descending (newest first)
      return dateB.getTime() - dateA.getTime();
    });
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
