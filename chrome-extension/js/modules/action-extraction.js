// Action Extraction Service
// Handles debounced extraction of action items from meeting notes

import { db } from '../db.js';
import { getAllMeetingSeries } from '../meetings.js';
import { getNotesByDate } from '../notes.js';
import { getAgendaItems } from '../agenda.js';
import { getActionItems, createActionItem } from '../actions.js';
import * as licenseManager from './license.js';

const DEBOUNCE_DELAY = 0; // 0 milliseconds for immediate extraction (testing mode)
// TODO: Change back to 5 * 60 * 1000 (5 minutes) for production
const RETRY_DELAYS = [10000, 30000]; // 10 seconds, 30 seconds
const MAX_RETRIES = 3;
const API_URL = 'http://localhost:8000/api/v1/extract-actions';

// Storage keys
const EXTRACTION_STATUS_KEY = 'extraction_status';
const PENDING_EXTRACTIONS_KEY = 'pending_extractions';

class ActionExtractionService {
  constructor() {
    this.timers = new Map(); // meetingId -> timeoutId
    this.statusBarElement = null;
    this.statusBarText = null;
    this.statusBarIndicator = null;
    this.inFlightCalls = new Map(); // meetingId -> Promise (tracks ongoing API calls)
  }

  // Initialize the service
  async init(statusBarElement) {
    this.statusBarElement = statusBarElement;
    if (statusBarElement) {
      this.statusBarText = statusBarElement.querySelector('.extraction-status-text');
      this.statusBarIndicator = statusBarElement.querySelector('.extraction-status-indicator');
    }
    
    // Check for pending extractions on startup (non-blocking)
    // Defer to avoid blocking UI initialization
    setTimeout(() => {
      this.checkPendingExtractions().catch(err => {
        console.error('[ActionExtraction] Error checking pending extractions:', err);
      });
    }, 100);
    
    // Note: checkAllMeetingsForExtraction() will be called after meetings are loaded
  }

  // Schedule extraction with debounce
  async scheduleExtraction(meetingId) {
    console.log(`[ActionExtraction] scheduleExtraction called for meeting ${meetingId}`);
    
    // If there's an in-flight call, wait for it to complete
    if (this.inFlightCalls.has(meetingId)) {
      console.log(`[ActionExtraction] Extraction already in progress for meeting ${meetingId}, waiting for completion...`);
      try {
        await this.inFlightCalls.get(meetingId);
      } catch (error) {
        console.error('[ActionExtraction] Error waiting for in-flight extraction:', error);
      }
      // After waiting, check if we still need to extract (new notes might have been added)
      const notesToExtract = await this.getNotesToExtract(meetingId);
      if (notesToExtract.length === 0) {
        console.log(`[ActionExtraction] No notes to extract after waiting for in-flight call`);
        return;
      }
    }

    // Clear existing timer for this meeting
    if (this.timers.has(meetingId)) {
      console.log(`[ActionExtraction] Clearing existing timer for meeting ${meetingId}`);
      clearTimeout(this.timers.get(meetingId));
    }

    // Store pending extraction
    this.savePendingExtraction(meetingId);

    console.log(`[ActionExtraction] Setting timer for meeting ${meetingId}, delay: ${DEBOUNCE_DELAY}ms`);
    
    // Set new timer
    const timerId = setTimeout(async () => {
      console.log(`[ActionExtraction] Timer expired for meeting ${meetingId}, calling extractActions`);
      await this.extractActions(meetingId);
      this.timers.delete(meetingId);
    }, DEBOUNCE_DELAY);

    this.timers.set(meetingId, timerId);
    
    // Update meeting status indicator to "pending"
    this.updateMeetingStatusIndicator(meetingId, 'pending');
  }

  // Save pending extraction state
  async savePendingExtraction(meetingId) {
    const pending = await chrome.storage.local.get(PENDING_EXTRACTIONS_KEY);
    const pendingExtractions = pending[PENDING_EXTRACTIONS_KEY] || {};
    
    pendingExtractions[meetingId] = {
      last_note_time: Date.now(),
      timer_id: this.timers.get(meetingId) || null
    };
    
    await chrome.storage.local.set({ [PENDING_EXTRACTIONS_KEY]: pendingExtractions });
  }

  // Check for pending extractions on startup
  async checkPendingExtractions() {
    const pending = await chrome.storage.local.get(PENDING_EXTRACTIONS_KEY);
    const pendingExtractions = pending[PENDING_EXTRACTIONS_KEY] || {};
    
    const now = Date.now();
    
    for (const [meetingId, data] of Object.entries(pendingExtractions)) {
      const timeSinceLastNote = now - data.last_note_time;
      
      if (timeSinceLastNote >= DEBOUNCE_DELAY) {
        // More than debounce delay passed, extract immediately
        await this.extractActions(meetingId);
      } else {
        // Resume timer
        const remainingTime = DEBOUNCE_DELAY - timeSinceLastNote;
        const timerId = setTimeout(async () => {
          await this.extractActions(meetingId);
          this.timers.delete(meetingId);
        }, remainingTime);
        
        this.timers.set(meetingId, timerId);
        this.updateMeetingStatusIndicator(meetingId, 'pending');
      }
    }
  }

  // Check all meetings for notes that need extraction
  async checkAllMeetingsForExtraction() {
    try {
      const allMeetings = await getAllMeetingSeries();
      
      // Early exit if no meetings
      if (allMeetings.length === 0) {
        return;
      }
      
      let totalNotesToExtract = 0;
      const meetingsWithNotes = [];
      
      // First, check all meetings and collect which ones need extraction
      for (const meeting of allMeetings) {
        const notesToExtract = await this.getNotesToExtract(meeting.id);
        
        if (notesToExtract.length > 0) {
          totalNotesToExtract += notesToExtract.length;
          meetingsWithNotes.push({ meeting, notesToExtract });
        }
      }
      
      // Early exit if no notes to extract
      if (meetingsWithNotes.length === 0) {
        return;
      }
      
      // Process each meeting sequentially to avoid concurrent API calls
      // But don't block - process in background
      for (const { meeting, notesToExtract } of meetingsWithNotes) {
        // Extract actions (this may make network calls, but it's deferred)
        // Don't await - let them process in parallel but sequentially
        this.extractActions(meeting.id).catch(err => {
          console.error(`[ActionExtraction] Error extracting actions for meeting ${meeting.id}:`, err);
        });
      }
    } catch (error) {
      console.error(`[ActionExtraction] Error checking all meetings:`, error);
    }
  }

  // Get notes that need extraction (not_actioned or action_failed)
  async getNotesToExtract(meetingId) {
    const notesByDate = await getNotesByDate(meetingId);
    const allNotes = notesByDate.flatMap(dateGroup => dateGroup.notes);
    
    // Filter notes that need extraction
    // Notes without actionStatus are treated as 'not_actioned' (for backward compatibility)
    const notesToExtract = allNotes.filter(note => {
      const status = note.actionStatus || 'not_actioned';
      return status === 'not_actioned' || status === 'action_failed';
    });
    
    return notesToExtract;
  }

  // Extract actions for a meeting
  async extractActions(meetingId) {
    console.log(`[ActionExtraction] extractActions called for meeting ${meetingId}`);
    
    // Check license access
    const access = await licenseManager.hasLLMAccess();
    if (!access.hasAccess) {
      console.log(`[ActionExtraction] Access denied - no license`);
      await this.showLicenseRequiredMessage(meetingId);
      return;
    }
    
    // Check if there's already an in-flight call
    if (this.inFlightCalls.has(meetingId)) {
      console.log(`[ActionExtraction] Extraction already in progress for meeting ${meetingId}, waiting for it to complete...`);
      // Wait for the existing extraction to complete
      await this.inFlightCalls.get(meetingId);
      return;
    }

    // Create extraction promise and track it
    const extractionPromise = (async () => {
      try {
        console.log(`[ActionExtraction] Starting extraction for meeting ${meetingId}`);
        
        // Get notes that need extraction
        const notesToExtract = await this.getNotesToExtract(meetingId);
        console.log(`[ActionExtraction] Found ${notesToExtract.length} notes to extract`);
        
        if (notesToExtract.length === 0) {
          console.log(`[ActionExtraction] No notes to extract for meeting ${meetingId} - all notes already processed`);
          return;
        }

        // Show status bar
        await this.showStatusBar('extracting', meetingId);

        // Get meeting details (pass notes to extract so we don't filter again after marking as in_progress)
        console.log(`[ActionExtraction] Getting meeting details for API call`);
        const meetingDetails = await this.getMeetingDetails(meetingId, notesToExtract);
        
        if (!meetingDetails || !meetingDetails.meeting_instance.notes.length) {
          console.log(`[ActionExtraction] No notes to extract for meeting ${meetingId}`);
          this.hideStatusBar();
          return;
        }

        // Mark notes as action_in_progress AFTER getting meeting details
        console.log(`[ActionExtraction] Marking ${notesToExtract.length} notes as action_in_progress`);
        await this.markNotesStatus(meetingId, notesToExtract, 'action_in_progress');

        console.log(`[ActionExtraction] Calling LLM API with ${meetingDetails.meeting_instance.notes.length} notes`);
        
        // Extract with retry logic
        const result = await this.extractWithRetry(meetingId, meetingDetails);

        if (result.success) {
          // Save extracted actions
          await this.saveExtractedActions(meetingId, result.data.notes_with_actions);
          
          // Mark processed notes as action_completed
          await this.markProcessedNotesStatus(meetingId, result.data.notes_with_actions, 'action_completed');
          
          // Update status
          await this.updateExtractionStatus(meetingId, 'completed', result.data);
          
          // Show success status
          await this.showStatusBar('success', meetingId);
          
          // Auto-hide after 3 seconds
          setTimeout(() => {
            this.hideStatusBar();
          }, 3000);
          
          // Update meeting status indicator
          await this.updateMeetingStatusIndicator(meetingId, 'completed');
          
          // Trigger UI refresh if needed
          // Import and call loadActions if we're viewing this meeting
          if (window.state && window.state.currentMeetingId === meetingId) {
            try {
              const { loadActions } = await import('../modules/actions-tab.js');
              await loadActions();
            } catch (error) {
              console.error('Error refreshing actions:', error);
            }
          }
        } else {
          // Mark notes as action_failed
          await this.markNotesStatus(meetingId, notesToExtract, 'action_failed');
          
          // Update status to failed
          await this.updateExtractionStatus(meetingId, 'failed', null, result.error);
          
          // Show failed status
          await this.showStatusBar('failed', meetingId);
          
          // Auto-hide after 5 seconds
          setTimeout(() => {
            this.hideStatusBar();
          }, 5000);
          
          // Update meeting status indicator
          this.updateMeetingStatusIndicator(meetingId, 'failed');
        }

        // Clear pending extraction
        await this.clearPendingExtraction(meetingId);

      } catch (error) {
        console.error('Error in extractActions:', error);
        // Mark notes as action_failed on error
        const notesToExtract = await this.getNotesToExtract(meetingId);
        await this.markNotesStatus(meetingId, notesToExtract, 'action_failed');
        
        await this.updateExtractionStatus(meetingId, 'failed', null, error.message);
        await this.showStatusBar('failed', meetingId);
        setTimeout(() => {
          this.hideStatusBar();
        }, 5000);
        this.updateMeetingStatusIndicator(meetingId, 'failed');
      } finally {
        // Remove from in-flight calls
        this.inFlightCalls.delete(meetingId);
      }
    })();

    // Track the in-flight call
    this.inFlightCalls.set(meetingId, extractionPromise);
    
    // Wait for extraction to complete
    await extractionPromise;
  }

  // Check if extraction should be skipped
  async shouldSkipExtraction(meetingId) {
    // Check if there are notes that need extraction
    const notesToExtract = await this.getNotesToExtract(meetingId);
    
    // Skip if no notes need extraction
    return notesToExtract.length === 0;
  }

  // Get note ID (create one if doesn't exist)
  getNoteId(note) {
    if (note.id) return note.id;
    // Create ID from text + createdAt
    return `${note.text}_${note.createdAt}`;
  }

  // Mark notes status in database
  async markNotesStatus(meetingId, notes, status) {
    const instances = await db.meetingInstances
      .where('seriesId')
      .equals(meetingId)
      .toArray();

    for (const instance of instances) {
      if (!Array.isArray(instance.notes)) continue;

      let updated = false;
      const updatedNotes = instance.notes.map(note => {
        // Match note by text and createdAt
        const noteId = this.getNoteId(note);
        const shouldUpdate = notes.some(n => this.getNoteId(n) === noteId);
        
        if (shouldUpdate) {
          updated = true;
          return { ...note, actionStatus: status };
        }
        return note;
      });

      if (updated) {
        await db.meetingInstances.update(instance.id, { notes: updatedNotes });
      }
    }
  }

  // Mark processed notes status based on API response
  async markProcessedNotesStatus(meetingId, notesWithActions, status) {
    const instances = await db.meetingInstances
      .where('seriesId')
      .equals(meetingId)
      .toArray();

    // Create a set of note texts that were processed (match by text and created_at)
    const processedNoteKeys = new Set();
    notesWithActions.forEach(nwa => {
      if (nwa.note && nwa.note.text) {
        const noteKey = `${nwa.note.text}_${nwa.note.created_at || ''}`;
        processedNoteKeys.add(noteKey);
      }
    });

    for (const instance of instances) {
      if (!Array.isArray(instance.notes)) continue;

      let updated = false;
      const updatedNotes = instance.notes.map(note => {
        const noteKey = `${note.text}_${note.createdAt ? new Date(note.createdAt).toISOString() : ''}`;
        if (processedNoteKeys.has(noteKey)) {
          updated = true;
          return { ...note, actionStatus: status };
        }
        return note;
      });

      if (updated) {
        await db.meetingInstances.update(instance.id, { notes: updatedNotes });
      }
    }
  }

  // Extract with retry logic
  async extractWithRetry(meetingId, meetingDetails, retryCount = 0) {
    try {
      console.log(`[ActionExtraction] API call attempt ${retryCount + 1} to ${API_URL}`);
      console.log(`[ActionExtraction] Request payload:`, JSON.stringify({ meeting_details: meetingDetails }, null, 2));
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ meeting_details: meetingDetails })
      });

      console.log(`[ActionExtraction] API response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ActionExtraction] API error response:`, errorText);
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[ActionExtraction] API response data:`, data);
      return { success: true, data };

    } catch (error) {
      console.error(`[ActionExtraction] Extraction attempt ${retryCount + 1} failed:`, error);
      console.error(`[ActionExtraction] Error details:`, error.message, error.stack);

      if (retryCount < MAX_RETRIES - 1) {
        // Wait before retry
        const delay = RETRY_DELAYS[retryCount] || 30000;
        console.log(`[ActionExtraction] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry
        return this.extractWithRetry(meetingId, meetingDetails, retryCount + 1);
      } else {
        // Max retries reached
        console.error(`[ActionExtraction] Max retries reached for meeting ${meetingId}`);
        return { success: false, error: error.message };
      }
    }
  }

  // Get meeting details for API (only includes notes that need extraction)
  async getMeetingDetails(meetingId, notesToExtractArray = null) {
    const meeting = await db.meetingSeries.get(meetingId);
    if (!meeting) return null;

    const agendaItems = await getAgendaItems(meetingId);
    const existingActions = await getActionItems(meetingId);

    // If notesToExtractArray is provided, use it directly (avoids re-filtering after marking as in_progress)
    // Otherwise, filter notes that need extraction (not_actioned or action_failed)
    let notesToExtract = [];
    
    if (notesToExtractArray && notesToExtractArray.length > 0) {
      // Use the provided notes array
      notesToExtract = notesToExtractArray.map(note => ({
        text: note.text,
        created_at: note.createdAt ? new Date(note.createdAt).toISOString() : null,
        updated_at: note.updatedAt ? new Date(note.updatedAt).toISOString() : null
      }));
    } else {
      // Fallback: filter from database
      const notesByDate = await getNotesByDate(meetingId);
      notesByDate.forEach(dateGroup => {
        dateGroup.notes.forEach(note => {
          const status = note.actionStatus || 'not_actioned';
          if (status === 'not_actioned' || status === 'action_failed') {
            notesToExtract.push({
              text: note.text,
              created_at: note.createdAt ? new Date(note.createdAt).toISOString() : null,
              updated_at: note.updatedAt ? new Date(note.updatedAt).toISOString() : null
            });
          }
        });
      });
    }

    // Get the most recent instance (or create one for today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const instances = await db.meetingInstances
      .where('seriesId')
      .equals(meetingId)
      .toArray();
    
    let instance = instances.find(inst => {
      const instDate = new Date(inst.date);
      instDate.setHours(0, 0, 0, 0);
      return instDate.getTime() === today.getTime();
    });

    if (!instance) {
      // Use the most recent instance if available
      if (instances.length > 0) {
        const sortedInstances = instances.sort((a, b) => new Date(b.date) - new Date(a.date));
        instance = sortedInstances[0];
      }
    }

    if (!instance) {
      // Create a placeholder instance
      instance = {
        id: `instance-${Date.now()}`,
        seriesId: meetingId,
        date: today,
        notes: []
      };
    }

    // Use filtered notes
    const notes = notesToExtract;

    return {
      meeting_series: {
        id: meeting.id.toString(),
        name: meeting.name,
        type: meeting.type,
        created_at: meeting.createdAt ? new Date(meeting.createdAt).toISOString() : null
      },
      meeting_instance: {
        id: instance.id.toString(),
        series_id: meetingId.toString(),
        date: instance.date ? new Date(instance.date).toISOString() : null,
        notes: notes,
        created_at: instance.createdAt ? new Date(instance.createdAt).toISOString() : null
      },
      agenda_items: agendaItems.map(item => ({
        id: item.id.toString(),
        series_id: meetingId.toString(),
        text: item.text,
        status: item.status,
        created_at: item.createdAt ? new Date(item.createdAt).toISOString() : null,
        closed_at: item.closedAt ? new Date(item.closedAt).toISOString() : null
      })),
      existing_actions: existingActions.map(action => ({
        text: action.text
      }))
    };
  }

  // Save extracted actions to database
  async saveExtractedActions(meetingId, notesWithActions) {
    const processedNoteIds = [];

    for (const noteWithActions of notesWithActions) {
      // Track processed notes
      const noteId = this.getNoteId(noteWithActions.note);
      processedNoteIds.push(noteId);

      // Save action items
      for (const actionItem of noteWithActions.action_items) {
        // Find the instance ID for this note
        const notesByDate = await getNotesByDate(meetingId);
        let instanceId = null;
        
        for (const dateGroup of notesByDate) {
          const note = dateGroup.notes.find(n => 
            this.getNoteId(n) === noteId
          );
          if (note) {
            instanceId = dateGroup.instanceId;
            break;
          }
        }

        // Create action item
        await createActionItem(
          meetingId,
          instanceId,
          actionItem.text
        );
      }
    }

    return processedNoteIds;
  }

  // Update extraction status
  async updateExtractionStatus(meetingId, status, resultData = null, error = null) {
    const statusData = await chrome.storage.local.get(EXTRACTION_STATUS_KEY);
    const extractionStatus = statusData[EXTRACTION_STATUS_KEY] || {};

    const meetingStatus = {
      status: status,
      last_extracted_at: status === 'completed' ? Date.now() : (extractionStatus[meetingId]?.last_extracted_at || null),
      processed_note_ids: resultData ? await this.getProcessedNoteIds(meetingId, resultData) : (extractionStatus[meetingId]?.processed_note_ids || []),
      retry_count: status === 'failed' ? (extractionStatus[meetingId]?.retry_count || 0) + 1 : 0,
      last_error: error || null
    };

    extractionStatus[meetingId] = meetingStatus;
    await chrome.storage.local.set({ [EXTRACTION_STATUS_KEY]: extractionStatus });
  }

  // Get processed note IDs from result
  async getProcessedNoteIds(meetingId, resultData) {
    const processedIds = [];
    const notesByDate = await getNotesByDate(meetingId);

    resultData.notes_with_actions.forEach((noteWithActions, index) => {
      // Match by index or find by text
      const allNotes = notesByDate.flatMap(dg => dg.notes);
      if (allNotes[index]) {
        processedIds.push(this.getNoteId(allNotes[index]));
      }
    });

    // Merge with existing processed IDs
    const status = await chrome.storage.local.get(EXTRACTION_STATUS_KEY);
    const extractionStatus = status[EXTRACTION_STATUS_KEY] || {};
    const existingIds = extractionStatus[meetingId]?.processed_note_ids || [];
    
    return [...new Set([...existingIds, ...processedIds])];
  }

  // Clear pending extraction
  async clearPendingExtraction(meetingId) {
    const pending = await chrome.storage.local.get(PENDING_EXTRACTIONS_KEY);
    const pendingExtractions = pending[PENDING_EXTRACTIONS_KEY] || {};
    delete pendingExtractions[meetingId];
    await chrome.storage.local.set({ [PENDING_EXTRACTIONS_KEY]: pendingExtractions });
  }

  // Show status bar
  async showStatusBar(state, meetingId) {
    if (!this.statusBarElement) return;

    const meeting = await db.meetingSeries.get(meetingId);
    const meetingName = meeting ? meeting.name : 'Meeting';

    let message = '';
    switch (state) {
      case 'extracting':
        message = `Extracting action items for ${meetingName}...`;
        break;
      case 'success':
        message = `Action items extracted for ${meetingName}`;
        break;
      case 'failed':
        message = `Failed to extract actions for ${meetingName}`;
        break;
    }

    this.statusBarElement.className = `extraction-status-bar active ${state}`;
    this.statusBarElement.style.display = 'flex';
    if (this.statusBarText) {
      this.statusBarText.textContent = message;
    }
  }

  // Hide status bar
  hideStatusBar() {
    if (this.statusBarElement) {
      this.statusBarElement.style.display = 'none';
      this.statusBarElement.className = 'extraction-status-bar';
    }
  }

  // Update meeting status indicator in sidebar
  async updateMeetingStatusIndicator(meetingId, status) {
    // Find the meeting item in sidebar
    const meetingItem = document.querySelector(`[data-meeting-id="${meetingId}"]`);
    if (!meetingItem) return;

    const metaElement = meetingItem.querySelector('.meeting-item-meta');
    if (!metaElement) return;

    // Remove existing indicator
    const existingIndicator = metaElement.querySelector('.meeting-extraction-status');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // Add new indicator based on status
    if (status === 'completed') {
      const indicator = document.createElement('div');
      indicator.className = 'meeting-extraction-status completed';
      indicator.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      metaElement.appendChild(indicator);
    } else if (status === 'pending') {
      const indicator = document.createElement('div');
      indicator.className = 'meeting-extraction-status pending';
      indicator.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1" fill="none"/>
          <path d="M6 3V6L8 7" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        </svg>
      `;
      metaElement.appendChild(indicator);
    } else if (status === 'failed') {
      const indicator = document.createElement('div');
      indicator.className = 'meeting-extraction-status failed';
      indicator.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1" fill="none"/>
          <path d="M4 4L8 8M8 4L4 8" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        </svg>
      `;
      metaElement.appendChild(indicator);
    }
  }

  // Load extraction status indicator for a meeting
  async loadExtractionStatusIndicator(meetingId, metaElement) {
    const status = await this.getExtractionStatus(meetingId);
    if (status && status.status !== null) {
      // Create indicator element
      const indicator = this.createStatusIndicator(status.status);
      if (indicator && metaElement) {
        metaElement.appendChild(indicator);
      }
    }
  }

  // Create status indicator element
  createStatusIndicator(status) {
    const indicator = document.createElement('div');
    
    if (status === 'completed') {
      indicator.className = 'meeting-extraction-status completed';
      indicator.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    } else if (status === 'pending') {
      indicator.className = 'meeting-extraction-status pending';
      indicator.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1" fill="none"/>
          <path d="M6 3V6L8 7" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        </svg>
      `;
    } else if (status === 'failed') {
      indicator.className = 'meeting-extraction-status failed';
      indicator.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1" fill="none"/>
          <path d="M4 4L8 8M8 4L4 8" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        </svg>
      `;
    } else {
      return null; // No indicator for null/undefined status
    }
    
    return indicator;
  }

  // Get extraction status for a meeting
  async getExtractionStatus(meetingId) {
    const status = await chrome.storage.local.get(EXTRACTION_STATUS_KEY);
    const extractionStatus = status[EXTRACTION_STATUS_KEY] || {};
    return extractionStatus[meetingId] || null;
  }

  // Show license required message
  async showLicenseRequiredMessage(meetingId) {
    if (!this.statusBarElement) return;

    const meeting = await db.meetingSeries.get(meetingId);
    const meetingName = meeting ? meeting.name : 'Meeting';

    this.statusBarElement.className = 'extraction-status-bar active license-required';
    this.statusBarElement.style.display = 'flex';
    
    if (this.statusBarText) {
      this.statusBarText.innerHTML = `
        Action extraction requires a premium license. 
        <a href="#" id="open-settings-link" style="color: inherit; text-decoration: underline;">Enter license key</a>
      `;
      
      // Add click handler for settings link
      const link = this.statusBarElement.querySelector('#open-settings-link');
      if (link) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          // Trigger settings view
          if (window.showSettingsView) {
            window.showSettingsView();
          }
        });
      }
    }
    
    // Auto-hide after 8 seconds
    setTimeout(() => {
      this.hideStatusBar();
    }, 8000);
  }
}

// Export singleton instance
export const actionExtractionService = new ActionExtractionService();
