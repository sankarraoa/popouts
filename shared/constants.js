/**
 * Shared Constants
 * 
 * Constants used by both client (Chrome extension) and server
 */

// Meeting Types
export const MeetingType = {
  ONE_ON_ONE: '1:1s',
  RECURRING: 'recurring',
  ADHOC: 'adhoc'
};

// Action Item Status
export const ActionStatus = {
  OPEN: 'open',
  CLOSED: 'closed'
};

// Agenda Item Status
export const AgendaStatus = {
  OPEN: 'open',
  CLOSED: 'closed'
};

// API Endpoints (when server is implemented)
export const API_ENDPOINTS = {
  LLM_EXTRACT_ACTIONS: '/api/llm/extract-actions',
  LLM_SUMMARIZE: '/api/llm/summarize',
  BACKUP_UPLOAD: '/api/backup/upload',
  BACKUP_DOWNLOAD: '/api/backup/download',
  SYNC: '/api/backup/sync'
};

// Data Limits
export const LIMITS = {
  MAX_NOTES_LENGTH: 10000,
  MAX_AGENDA_ITEMS: 100,
  MAX_ACTION_ITEMS: 200
};
