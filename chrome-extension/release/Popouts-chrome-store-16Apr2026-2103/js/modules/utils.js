// Utility functions

import { getAllActionItems } from '../actions.js';
import { getNotesByDate } from '../notes.js';
import { getAllMeetingSeries } from '../meetings.js';
import { state } from './state.js';

// Format date for display
export function formatDate(date) {
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  
  const month = date.toLocaleString('default', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
}

// Format last date with time
export function formatLastDate(date) {
  const now = new Date();
  const diff = now - date;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  
  if (hours < 1) return 'Just now';
  
  // Format: "Wed, Feb 18, 2026 at 10:00 AM"
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const dayName = days[date.getDay()];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const h = date.getHours();
  const m = date.getMinutes();
  const hour12 = h % 12 || 12;
  const minutes = String(m).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  
  return `${dayName}, ${month} ${day}, ${year} at ${hour12}:${minutes} ${ampm}`;
}

// Format note date
export function formatNoteDate(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const cardDate = new Date(dateObj);
  cardDate.setHours(0, 0, 0, 0);
  
  if (cardDate.getTime() === now.getTime()) {
    return 'Today';
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (cardDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }
  
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const dayName = days[cardDate.getDay()];
  const month = months[cardDate.getMonth()];
  const day = cardDate.getDate();
  const year = cardDate.getFullYear();
  
  return `${dayName}, ${month} ${day}, ${year}`;
}

// Check if date is today
export function isToday(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const checkDate = new Date(dateObj);
  checkDate.setHours(0, 0, 0, 0);
  
  return checkDate.getTime() === today.getTime();
}

// ── Action item date helpers ──

/** Return a date string for divider labels: "Today", "Yesterday", or "Wed, Apr 9" */
export function formatActionDividerDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (d.getTime() === now.getTime()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.getTime() === yesterday.getTime()) return 'Yesterday';

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

/** Return the calendar-day key (YYYY-MM-DD) for grouping. */
export function dateDayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Return a relative-age object: { text: '2d', level: 'fresh'|'medium'|'old' }
 *   fresh  = created today or yesterday
 *   medium = 2–7 days ago
 *   old    = > 7 days ago
 */
export function getActionAge(createdAt) {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now - created;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) return { text: diffDays === 0 ? 'today' : '1d', level: 'fresh' };
  if (diffDays < 7) return { text: `${diffDays}d`, level: 'medium' };
  const weeks = Math.floor(diffDays / 7);
  if (weeks < 4) return { text: `${weeks}w`, level: 'old' };
  const months = Math.floor(diffDays / 30);
  return { text: `${months}mo`, level: 'old' };
}

/** Create a DOM element for a date divider row. */
export function createActionDateDivider(dateStr, count) {
  const divider = document.createElement('div');
  divider.className = 'action-date-divider';

  const label = document.createElement('span');
  label.className = 'action-date-divider-text';
  label.textContent = dateStr;

  const line = document.createElement('div');
  line.className = 'action-date-divider-line';

  const countEl = document.createElement('span');
  countEl.className = 'action-date-divider-count';
  countEl.textContent = `${count} item${count !== 1 ? 's' : ''}`;

  divider.appendChild(label);
  divider.appendChild(line);
  divider.appendChild(countEl);
  return divider;
}

/** Create a DOM element for an age tag. */
export function createAgeTag(createdAt) {
  const age = getActionAge(createdAt);
  const tag = document.createElement('span');
  tag.className = `action-age-tag action-age-tag-${age.level}`;
  tag.textContent = age.text;
  return tag;
}

// Update counts in header
export async function updateCounts(elements) {
  if (!elements) {
    console.warn('updateCounts called without elements object');
    return;
  }
  
  const allMeetings = await getAllMeetingSeries();
  if (elements.meetingsCount) {
    elements.meetingsCount.textContent = allMeetings.length;
  }

  const allActions = await getAllActionItems('open');
  if (elements.actionsCount) {
    elements.actionsCount.textContent = allActions.length;
  }

  // Update notes count for current meeting
  if (state.currentMeetingId) {
    const notesByDate = await getNotesByDate(state.currentMeetingId);
    const totalNotes = notesByDate.reduce((sum, dateGroup) => sum + dateGroup.notes.length, 0);
    if (elements.notesCount) {
      elements.notesCount.textContent = totalNotes;
    }
  } else {
    if (elements.notesCount) {
      elements.notesCount.textContent = '0';
    }
  }
}
