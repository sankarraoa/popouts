// Agenda items management
import { db } from './db.js';

// Create an agenda item
export async function createAgendaItem(seriesId, text) {
  const id = await db.agendaItems.add({
    seriesId,
    text,
    status: 'open',
    createdAt: new Date(),
    closedAt: null
  });
  return id;
}

// Get all agenda items for a meeting series
export async function getAgendaItems(seriesId, filter = 'all') {
  let items = await db.agendaItems.where('seriesId').equals(seriesId).toArray();
  
  if (filter === 'open') {
    items = items.filter(item => item.status === 'open');
  } else if (filter === 'closed') {
    items = items.filter(item => item.status === 'closed');
  }
  
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Update agenda item
async function updateAgendaItem(id, updates) {
  await db.agendaItems.update(id, updates);
}

// Toggle agenda item status (open/closed)
export async function toggleAgendaItem(id) {
  const item = await db.agendaItems.get(id);
  if (item) {
    await db.agendaItems.update(id, {
      status: item.status === 'open' ? 'closed' : 'open',
      closedAt: item.status === 'open' ? new Date() : null
    });
  }
}

// Delete agenda item
async function deleteAgendaItem(id) {
  await db.agendaItems.delete(id);
}
