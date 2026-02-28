// Meeting view orchestrator - coordinates tab switching and meeting selection
import { state, saveState } from './state.js';
import { formatLastDate } from './utils.js';
import { loadAgenda } from './agenda-tab.js';
import { loadNotes } from './notes-tab.js';
import { loadActions } from './actions-tab.js';
import { getMeetingStats } from '../meetings.js';

// Placeholder for elements object, will be passed from main orchestrator
let elements = {};
// Placeholder for updateCounts callback
let updateCountsCallback = null;

export function setMeetingViewDependencies(els, updateCountsCb) {
  elements = els;
  updateCountsCallback = updateCountsCb;
}

// Helper function to safely call updateCounts
async function safeUpdateCounts() {
  if (updateCountsCallback) {
    await updateCountsCallback();
  }
}

// Select a meeting and load its details
export async function selectMeeting(meetingId) {
  console.log('[MeetingView] selectMeeting called for meetingId:', meetingId);
  
  if (!meetingId) {
    // Clear selection
    state.currentMeetingId = null;
    if (elements.emptyState) elements.emptyState.style.display = 'flex';
    if (elements.meetingDetail) elements.meetingDetail.style.display = 'none';
    
    // Clear all tab views
    if (elements.agendaView) elements.agendaView.classList.remove('active');
    if (elements.notesView) elements.notesView.classList.remove('active');
    if (elements.actionsView) elements.actionsView.classList.remove('active');
    
    // Remove selected class from all meeting items
    const allItems = document.querySelectorAll('.meeting-item');
    console.log('[MeetingView] Clearing selection from', allItems.length, 'meeting items');
    allItems.forEach(item => {
      const hadSelected = item.classList.contains('selected');
      item.classList.remove('selected');
      if (hadSelected) {
        console.log('[MeetingView] Removed selected class from item:', item.dataset.meetingId);
      }
    });
    
    return;
  }
  
  state.currentMeetingId = meetingId;
  
  // Hide empty state, show meeting detail
  if (elements.emptyState) elements.emptyState.style.display = 'none';
  if (elements.meetingDetail) elements.meetingDetail.style.display = 'flex';
  
  // Update selected meeting item
  const allItems = document.querySelectorAll('.meeting-item');
  console.log('[MeetingView] Updating selection for', allItems.length, 'meeting items, selecting:', meetingId);
  const meetingIdStr = String(meetingId);
  allItems.forEach(item => {
    const wasSelected = item.classList.contains('selected');
    item.classList.remove('selected');
    if (String(item.dataset.meetingId) === meetingIdStr) {
      item.classList.add('selected');
      console.log('[MeetingView] Added selected class to item:', meetingId, 'Element:', item, 'Computed background:', window.getComputedStyle(item).backgroundColor);
    } else if (wasSelected) {
      console.log('[MeetingView] Removed selected class from item:', item.dataset.meetingId);
    }
  });
  
  // Get meeting details
  const { getMeetingSeries } = await import('../meetings.js');
  const meeting = await getMeetingSeries(meetingId);
  if (!meeting) {
    console.error('[MeetingView] Meeting not found:', meetingId);
    return;
  }
  
  // Update meeting title
  if (elements.meetingTitle) {
    elements.meetingTitle.textContent = meeting.name;
  }
  
  // Update last date
  const stats = await getMeetingStats(meetingId);
  if (elements.meetingLastDate) {
    if (stats.lastDate) {
      elements.meetingLastDate.textContent = formatLastDate(stats.lastDate);
    } else {
      elements.meetingLastDate.textContent = 'Never';
    }
  }
  
  // Update tab counts
  if (elements.agendaCount) {
    elements.agendaCount.textContent = stats.openAgendaCount || 0;
  }
  if (elements.notesCount) {
    elements.notesCount.textContent = stats.noteCount || 0;
  }
  if (elements.actionsDetailCount) {
    const { getActionItems } = await import('../actions.js');
    const openActions = await getActionItems(meetingId, 'open');
    elements.actionsDetailCount.textContent = openActions.length;
  }
  
  // Load current view
  await switchView(state.currentView);
  
  // Update counts
  await safeUpdateCounts();
  
  // Save state
  await saveState(elements);
}

// Switch between tabs (agenda, notes, actions)
export async function switchView(view) {
  if (!state.currentMeetingId) {
    return;
  }
  
  state.currentView = view;
  
  // Hide all views
  if (elements.agendaView) elements.agendaView.classList.remove('active');
  if (elements.notesView) elements.notesView.classList.remove('active');
  if (elements.actionsView) elements.actionsView.classList.remove('active');
  
  // Remove active class from all tabs
  if (elements.meetingTabs) {
    elements.meetingTabs.forEach(tab => {
      tab.classList.remove('active');
    });
  }
  
  // Show selected view and activate corresponding tab
  switch (view) {
    case 'agenda':
      if (elements.agendaView) elements.agendaView.classList.add('active');
      const agendaTab = document.querySelector('.meeting-tab[data-view="agenda"]');
      if (agendaTab) agendaTab.classList.add('active');
      await loadAgenda();
      
      // Auto-focus agenda input when agenda view is shown (if filter is 'all' or 'open')
      if (state.currentAgendaFilter === 'all' || state.currentAgendaFilter === 'open') {
        const agendaInput = document.getElementById('agenda-input');
        if (agendaInput) {
          setTimeout(() => {
            agendaInput.focus();
          }, 150);
        }
      }
      break;
      
    case 'notes':
      if (elements.notesView) elements.notesView.classList.add('active');
      const notesTab = document.querySelector('.meeting-tab[data-view="notes"]');
      if (notesTab) notesTab.classList.add('active');
      await loadNotes();
      break;
      
    case 'actions':
      if (elements.actionsView) elements.actionsView.classList.add('active');
      const actionsTab = document.querySelector('.meeting-tab[data-view="actions"]');
      if (actionsTab) actionsTab.classList.add('active');
      await loadActions();
      
      // Auto-focus action input when actions view is shown (if filter is 'all' or 'open')
      if (state.currentActionFilter === 'all' || state.currentActionFilter === 'open') {
        const actionsInput = document.getElementById('actions-input');
        if (actionsInput) {
          setTimeout(() => {
            actionsInput.focus();
          }, 150);
        }
      }
      break;
  }
  
  // Save state
  await saveState(elements);
}
