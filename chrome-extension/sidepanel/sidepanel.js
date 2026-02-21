// Main sidepanel JavaScript - Refactored with ES6 modules

// Import modules
import { state, saveState, restoreState } from '../js/modules/state.js';
import { updateCounts } from '../js/modules/utils.js';
import { loadMeetings, initSidebar } from '../js/modules/sidebar.js';
import { loadAgenda, setAgendaDependencies } from '../js/modules/agenda-tab.js';
import { loadNotes, setNotesDependencies } from '../js/modules/notes-tab.js';
import { loadActions, setActionsDependencies, createActionItemElement } from '../js/modules/actions-tab.js';
import { loadConsolidatedActions, showAddActionSection, hideAddActionSection, handleAddAction, setConsolidatedActionsDependencies } from '../js/modules/consolidated-actions.js';
import { selectMeeting, switchView, setMeetingViewDependencies } from '../js/modules/meeting-view.js';
import { createAgendaItem } from '../js/agenda.js';
import { createActionItem } from '../js/actions.js';
import { addNote } from '../js/notes.js';
import { getAllMeetingSeries } from '../js/meetings.js';
import { db } from '../js/db.js';

// DOM Elements - will be populated after DOM is ready
const elements = {};

// Initialize DOM elements
function initializeElements() {
  console.log('=== INITIALIZING ELEMENTS ===');
  
  elements.meetingsTab = document.querySelector('[data-tab="meetings"]');
  elements.actionsTab = document.querySelector('[data-tab="actions"]');
  elements.meetingsCount = document.getElementById('meetings-count');
  elements.actionsCount = document.getElementById('actions-count');
  
  elements.categoryToggles = document.querySelectorAll('.category-toggle');
  elements.addButtons = document.querySelectorAll('.add-button');
  elements.meetingLists = document.querySelectorAll('.meeting-list');
  
  elements.emptyState = document.getElementById('empty-state');
  elements.meetingDetail = document.getElementById('meeting-detail');
  elements.consolidatedActionsView = document.getElementById('consolidated-actions-view');
  elements.meetingTitle = document.getElementById('meeting-title');
  elements.meetingLastDate = document.getElementById('meeting-last-date');
  
  elements.meetingTabs = document.querySelectorAll('.meeting-tab');
  elements.agendaView = document.getElementById('agenda-view');
  elements.notesView = document.getElementById('notes-view');
  elements.actionsView = document.getElementById('actions-view');
  
  elements.consolidatedActionsList = document.getElementById('consolidated-actions-list');
  elements.consolidatedActionsFilters = document.querySelectorAll('#consolidated-actions-filters .filter-button');
  
  elements.agendaInput = document.getElementById('agenda-input');
  elements.agendaList = document.getElementById('agenda-list');
  elements.agendaFilters = document.querySelectorAll('#agenda-view .filter-button');
  elements.agendaCount = document.getElementById('agenda-count');
  
  elements.notesContainer = document.getElementById('notes-container');
  elements.notesCount = document.getElementById('notes-count');
  
  elements.actionsAddButton = document.getElementById('actions-add-button');
  elements.actionsSearchInput = document.getElementById('actions-search-input');
  elements.consolidatedActionsSearchInput = document.getElementById('consolidated-actions-search-input');
  elements.actionsList = document.getElementById('actions-list');
  elements.actionsFilters = document.querySelectorAll('#actions-view .filter-button');
  elements.actionsDetailCount = document.getElementById('actions-detail-count');
  elements.actionsInput = document.getElementById('actions-input');
  
  // Add Action elements
  elements.addActionContainer = document.getElementById('add-action-container');
  elements.addActionInput = document.getElementById('add-action-input');
  elements.addActionDropdown = document.getElementById('add-action-dropdown');
  elements.addActionDropdownButton = document.getElementById('add-action-dropdown-button');
  elements.addActionDropdownSelected = document.getElementById('add-action-dropdown-selected');
}

// Initialize
async function init() {
  try {
    console.log('=== INIT STARTING ===');
    
    // Ensure database is ready first
    console.log('Ensuring database is ready...');
    await db.ensureReady();
    console.log('Database ready');
    
    // Initialize elements first
    initializeElements();
    
    // Set up module dependencies
    // Wrap updateCounts to always pass elements
    const updateCountsWithElements = async () => await updateCounts(elements);
    setAgendaDependencies(elements, updateCountsWithElements);
    setNotesDependencies(elements, updateCountsWithElements);
    setActionsDependencies(elements, updateCountsWithElements, loadConsolidatedActions);
    setConsolidatedActionsDependencies(elements, updateCountsWithElements);
    setMeetingViewDependencies(elements, updateCountsWithElements);
    initSidebar(elements, { 
      selectMeeting, 
      updateCounts: async () => await updateCounts(elements), 
      saveState: async () => await saveState(elements), 
      loadMeetings: async () => await loadMeetings(elements) 
    });
    
    // Load meetings
    try {
      await loadMeetings(elements);
      console.log('Meetings loaded');
    } catch (err) {
      console.error('Error loading meetings:', err);
    }
    
    // Setup event listeners
    try {
      setupEventListeners();
      console.log('Event listeners setup');
    } catch (err) {
      console.error('Error setting up event listeners:', err);
    }
    
    // Restore state
    try {
      await restoreState(elements);
      console.log('State restored');
    } catch (err) {
      console.error('Error restoring state:', err);
    }
    
    // Update counts
    try {
      await updateCounts(elements);
      console.log('Counts updated');
    } catch (err) {
      console.error('Error updating counts:', err);
    }
    
    // Add sample notes for testing
    await addSampleNotesIfNeeded();
    
    console.log('=== INIT COMPLETE ===');
  } catch (error) {
    console.error('Error in init():', error);
    console.error('Stack:', error.stack);
  }
}

// Add sample notes for testing
async function addSampleNotesIfNeeded() {
  try {
    const allMeetings = await getAllMeetingSeries();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const dayBeforeYesterday = new Date(today);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    
    // Check for "with Arti" meeting
    const artiMeeting = allMeetings.find(m => m.name.toLowerCase().includes('arti'));
    if (artiMeeting) {
      const { getNotesByDate } = await import('../js/notes.js');
      const artiNotesByDate = await getNotesByDate(artiMeeting.id);
      
      // Only add if no notes exist
      if (artiNotesByDate.length === 0) {
        await addNote(artiMeeting.id, 'Discussed project timeline and deliverables. Need to follow up on budget approval.', yesterday);
        await addNote(artiMeeting.id, 'Reviewed Q1 goals and progress. Arti is on track with all milestones.', yesterday);
        await addNote(artiMeeting.id, 'Covered sprint planning and resource allocation. Arti to lead the next standup.', dayBeforeYesterday);
      }
    }
    
    // Check for "with Harshita" meeting
    const harishitaMeeting = allMeetings.find(m => m.name.toLowerCase().includes('harshita') || m.name.toLowerCase().includes('harishita'));
    if (harishitaMeeting) {
      const { getNotesByDate } = await import('../js/notes.js');
      const harishitaNotesByDate = await getNotesByDate(harishitaMeeting.id);
      
      if (harishitaNotesByDate.length === 0) {
        await addNote(harishitaMeeting.id, 'Discussed quarterly planning and team goals.', today);
        await addNote(harishitaMeeting.id, 'Harishita will follow up on budget allocation next week.', today);
      }
    }
    
    // Check for "Meeting with M2P" meeting
    const m2pMeeting = allMeetings.find(m => m.name.toLowerCase().includes('m2p'));
    if (m2pMeeting) {
      const { getNotesByDate } = await import('../js/notes.js');
      const m2pNotesByDate = await getNotesByDate(m2pMeeting.id);
      
      if (m2pNotesByDate.length === 0) {
        await addNote(m2pMeeting.id, 'Reviewed integration requirements and API specifications.', today);
        await addNote(m2pMeeting.id, 'M2P team will provide updated documentation by end of week.', today);
        await addNote(m2pMeeting.id, 'Scheduled follow-up meeting to discuss implementation timeline.', yesterday);
      }
    }
  } catch (error) {
    console.error('Error adding sample notes:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Header tabs
  if (elements.meetingsTab) {
    elements.meetingsTab.addEventListener('click', () => {
      elements.meetingsTab.classList.add('active');
      elements.actionsTab.classList.remove('active');
      // Show meetings view
      if (elements.consolidatedActionsView) {
        elements.consolidatedActionsView.style.display = 'none';
        elements.consolidatedActionsView.classList.remove('active');
      }
      if (elements.emptyState) elements.emptyState.style.display = 'flex';
      if (elements.meetingDetail) elements.meetingDetail.style.display = 'none';
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) sidebar.style.display = 'flex';
    });
  }
  
  if (elements.actionsTab) {
    elements.actionsTab.addEventListener('click', async () => {
      console.log('=== Actions tab clicked ===');
      elements.actionsTab.classList.add('active');
      elements.meetingsTab.classList.remove('active');
      // Show consolidated actions view
      if (elements.consolidatedActionsView) {
        console.log('Showing consolidated actions view');
        elements.consolidatedActionsView.style.display = 'flex';
      } else {
        console.error('consolidatedActionsView not found!');
      }
      if (elements.emptyState) elements.emptyState.style.display = 'none';
      if (elements.meetingDetail) elements.meetingDetail.style.display = 'none';
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) sidebar.style.display = 'none';
      await loadConsolidatedActions();
    });
  }
  
  // Meeting tabs
  elements.meetingTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      switchView(view);
    });
  });
  
  // Agenda input
  if (elements.agendaInput) {
    elements.agendaInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter' && e.target.value.trim() && state.currentMeetingId) {
        await createAgendaItem(state.currentMeetingId, e.target.value.trim());
        e.target.value = '';
        await loadAgenda();
        await updateCounts(elements);
      }
    });
  }
  
  // Agenda filters
  if (elements.agendaFilters && elements.agendaFilters.length > 0) {
    elements.agendaFilters.forEach(filter => {
      filter.addEventListener('click', async () => {
        elements.agendaFilters.forEach(f => f.classList.remove('active'));
        filter.classList.add('active');
        state.currentAgendaFilter = filter.dataset.filter;
        await loadAgenda();
        await saveState(elements);
      });
    });
  }
  
  // Add Action button - show add action input section
  const consolidatedAddButton = document.getElementById('consolidated-actions-add-button');
  if (consolidatedAddButton) {
    consolidatedAddButton.addEventListener('click', () => {
      showAddActionSection();
    });
  }
  
  if (elements.actionsAddButton) {
    elements.actionsAddButton.addEventListener('click', () => {
      showAddActionSection();
    });
  }
  
  // Add Action input handlers
  if (elements.addActionInput) {
    elements.addActionInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await handleAddAction();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideAddActionSection();
      }
    });
  }
  
  // Dropdown button click handler
  if (elements.addActionDropdownButton) {
    elements.addActionDropdownButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (elements.addActionDropdown) {
        const isVisible = elements.addActionDropdown.style.display !== 'none';
        elements.addActionDropdown.style.display = isVisible ? 'none' : 'flex';
      }
    });
  }
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (elements.addActionDropdown && 
        elements.addActionDropdownButton &&
        !elements.addActionDropdown.contains(e.target) &&
        !elements.addActionDropdownButton.contains(e.target)) {
      elements.addActionDropdown.style.display = 'none';
    }
  });
  
  // Actions filters (for meeting-specific actions)
  if (elements.actionsFilters && elements.actionsFilters.length > 0) {
    elements.actionsFilters.forEach(filter => {
      filter.addEventListener('click', async () => {
        elements.actionsFilters.forEach(f => f.classList.remove('active'));
        filter.classList.add('active');
        state.currentActionFilter = filter.dataset.filter;
        await loadActions();
        await saveState(elements);
      });
    });
  }
  
  // Actions input (for meeting-specific actions)
  if (elements.actionsInput) {
    // Save input value on change
    elements.actionsInput.addEventListener('input', (e) => {
      if (state.currentMeetingId) {
        state.actionInputValues[state.currentMeetingId] = e.target.value;
      }
    });
    
    elements.actionsInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter' && e.target.value.trim() && state.currentMeetingId) {
        const text = e.target.value.trim();
        e.target.value = '';
        // Clear stored value after adding
        state.actionInputValues[state.currentMeetingId] = '';
        
        // Get or create today's instance
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const instances = await db.meetingInstances
          .where('seriesId')
          .equals(state.currentMeetingId)
          .toArray();
        
        let instance = instances.find(inst => {
          const instDate = new Date(inst.date);
          instDate.setHours(0, 0, 0, 0);
          return instDate.getTime() === today.getTime();
        });
        
        if (!instance) {
          instance = {
            seriesId: state.currentMeetingId,
            date: today,
            createdAt: new Date()
          };
          instance.id = await db.meetingInstances.add(instance);
        }
        
        await createActionItem(state.currentMeetingId, instance.id, text);
        await loadActions();
        await updateCounts(elements);
      }
    });
  }
  
  // Consolidated actions filters
  if (elements.consolidatedActionsFilters && elements.consolidatedActionsFilters.length > 0) {
    elements.consolidatedActionsFilters.forEach(filter => {
      filter.addEventListener('click', () => {
        elements.consolidatedActionsFilters.forEach(f => f.classList.remove('active'));
        filter.classList.add('active');
        state.currentActionFilter = filter.dataset.filter;
        loadConsolidatedActions();
      });
    });
  }
  
  // Consolidated actions search input - filter on Enter
  if (elements.consolidatedActionsSearchInput) {
    elements.consolidatedActionsSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        state.currentActionSearchQuery = e.target.value;
        loadConsolidatedActions();
      }
    });
  }
}

// Save state when popup is about to close
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) {
    await saveState(elements);
  }
});

// Also save on beforeunload as backup
window.addEventListener('beforeunload', async () => {
  await saveState(elements);
});

// Initialize on load
console.log('=== SCRIPT LOADING ===');
console.log('Document ready state:', document.readyState);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired, calling init()');
    init();
  });
} else {
  console.log('Document already ready, calling init() immediately');
  init();
}
