/**
 * Shared Type Definitions
 * 
 * Data structures used by both client and server
 * (JSDoc comments for type hints)
 */

/**
 * @typedef {Object} MeetingSeries
 * @property {string} id - Unique identifier
 * @property {string} name - Meeting name
 * @property {string} type - Meeting type (1:1s, recurring, adhoc)
 * @property {Date} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} MeetingInstance
 * @property {string} id - Unique identifier
 * @property {string} seriesId - Parent meeting series ID
 * @property {Date} date - Meeting date
 * @property {Array<Note>} notes - Array of notes
 * @property {Date} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} Note
 * @property {string} text - Note text content
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} [updatedAt] - Last update timestamp
 */

/**
 * @typedef {Object} AgendaItem
 * @property {string} id - Unique identifier
 * @property {string} seriesId - Parent meeting series ID
 * @property {string} text - Agenda item text
 * @property {string} status - Status (open/closed)
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} [closedAt] - Closure timestamp
 */

/**
 * @typedef {Object} ActionItem
 * @property {string} id - Unique identifier
 * @property {string} seriesId - Parent meeting series ID
 * @property {string} instanceId - Meeting instance ID
 * @property {string} text - Action item text
 * @property {string} [assignee] - Assigned person
 * @property {Date} [dueDate] - Due date
 * @property {string} status - Status (open/closed)
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} [closedAt] - Closure timestamp
 */

/**
 * @typedef {Object} BackupData
 * @property {string} userId - User identifier
 * @property {Array<MeetingSeries>} meetings - All meeting series
 * @property {Array<MeetingInstance>} instances - All meeting instances
 * @property {Array<AgendaItem>} agendaItems - All agenda items
 * @property {Array<ActionItem>} actionItems - All action items
 * @property {Date} timestamp - Backup timestamp
 */
