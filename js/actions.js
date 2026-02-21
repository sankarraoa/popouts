// Action items management
import { db } from './db.js';

// Create an action item
export async function createActionItem(seriesId, instanceId, text, assignee = null, dueDate = null) {
  const id = await db.actionItems.add({
    seriesId,
    instanceId,
    text,
    assignee,
    dueDate,
    status: 'open',
    createdAt: new Date(),
    closedAt: null
  });
  return id;
}

// Get all action items for a meeting series
export async function getActionItems(seriesId, filter = 'all') {
  let items = await db.actionItems.where('seriesId').equals(seriesId).toArray();
  
  if (filter === 'open') {
    items = items.filter(item => item.status === 'open');
  } else if (filter === 'closed') {
    items = items.filter(item => item.status === 'closed');
  }
  
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Get all action items across all meetings
export async function getAllActionItems(filter = 'all') {
  let items = await db.actionItems.toArray();
  
  if (filter === 'open') {
    items = items.filter(item => item.status === 'open');
  } else if (filter === 'closed') {
    items = items.filter(item => item.status === 'closed');
  }
  
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Update action item
async function updateActionItem(id, updates) {
  await db.actionItems.update(id, updates);
}

// Toggle action item status (open/closed)
export async function toggleActionItem(id) {
  const item = await db.actionItems.get(id);
  if (item) {
    await db.actionItems.update(id, {
      status: item.status === 'open' ? 'closed' : 'open',
      closedAt: item.status === 'open' ? new Date() : null
    });
  }
}

// Delete action item
async function deleteActionItem(id) {
  await db.actionItems.delete(id);
}
