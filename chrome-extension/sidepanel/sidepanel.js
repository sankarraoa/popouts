// Main sidepanel JavaScript - Refactored with ES6 modules

// Import modules
import { state, saveState, restoreState } from '../js/modules/state.js';
import { updateCounts } from '../js/modules/utils.js';
import { loadMeetings, initSidebar } from '../js/modules/sidebar.js';
import { loadAgenda, setAgendaDependencies, handleShowMoreAgenda } from '../js/modules/agenda-tab.js';
import { loadNotes, setNotesDependencies, handleShowMoreNotes } from '../js/modules/notes-tab.js';
import { loadActions, setActionsDependencies, createActionItemElement, handleShowMoreActions } from '../js/modules/actions-tab.js';
import { loadConsolidatedActions, showAddActionSection, hideAddActionSection, handleAddAction, handleShowMore, setConsolidatedActionsDependencies } from '../js/modules/consolidated-actions.js';
import { selectMeeting, switchView, setMeetingViewDependencies } from '../js/modules/meeting-view.js';
import { createAgendaItem } from '../js/agenda.js';
import { updateMeetingBadge } from '../js/modules/sidebar.js';
import { createActionItem } from '../js/actions.js';
import { addNote } from '../js/notes.js';
import { getAllMeetingSeries } from '../js/meetings.js';
import { db } from '../js/db.js';
import { actionExtractionService } from '../js/modules/action-extraction.js';
import * as licenseManager from '../js/modules/license.js';

// Make state available globally for extraction service
window.state = state;

// Make settings function available globally
window.showSettingsView = showSettingsView;

// DOM Elements - will be populated after DOM is ready
const elements = {};

// Initialize DOM elements
function initializeElements() {
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
  elements.meetingTitleEdit = document.getElementById('meeting-title-edit');
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
  
  elements.extractionStatusBar = document.getElementById('extraction-status-bar');
  elements.settingsButton = document.getElementById('settings-button');
  elements.helpButton = document.getElementById('help-button');
  elements.settingsView = document.getElementById('settings-view');
  elements.settingsBackButton = document.getElementById('settings-back-button');
  elements.settingsNameInput = document.getElementById('settings-name-input');
  elements.settingsProductKeyInput = document.getElementById('settings-product-key-input');
  // License status elements - will be initialized when Settings view is shown
  // (they might not exist in DOM until Settings view is displayed)
  elements.licenseStatusActive = document.getElementById('license-status-active');
  elements.licenseStatusExpired = document.getElementById('license-status-expired');
  elements.licenseExpiryText = document.getElementById('license-expiry-text');
  elements.licenseExpiredText = document.getElementById('license-expired-text');
}

// Initialize
async function init() {
  try {
    // Initialize elements first (synchronous, fast)
    initializeElements();
    
    // Setup event listeners early (non-blocking UI interactions)
    setupEventListeners();
    
    // Ensure database is ready
    await db.ensureReady();
    
    // Set up module dependencies
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
    
    // Restore state (needed for UI)
    await restoreState(elements);
    
    // Update counts (needed for UI)
    await updateCounts(elements);
    
    // Load meetings (needed for UI)
    await loadMeetings(elements);
    
    // Initialize action extraction service (non-blocking, deferred operations)
    // Don't await - let it initialize in background
    actionExtractionService.init(elements.extractionStatusBar).then(() => {
      // Defer extraction check to after UI is loaded
      // Use setTimeout to ensure UI is fully rendered first
      setTimeout(async () => {
        try {
          // Quick check: skip if no meetings
          const allMeetings = await getAllMeetingSeries();
          if (allMeetings.length > 0) {
            await actionExtractionService.checkAllMeetingsForExtraction();
          }
        } catch (err) {
          console.error('Error checking meetings for extraction:', err);
        }
      }, 500); // 500ms delay to let UI render first
    }).catch(err => {
      console.error('Error initializing action extraction service:', err);
    });
    
    // Add sample notes for testing (deferred)
    setTimeout(() => {
      addSampleNotesIfNeeded().catch(err => {
        console.error('Error adding sample notes:', err);
      });
    }, 100);
    
  } catch (error) {
    console.error('Error in init():', error);
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
    
    // Check for "1:1 with Aarti" meeting - create extensive sample data
    const artiMeeting = allMeetings.find(m => m.name.toLowerCase().includes('arti') || m.name.toLowerCase().includes('aarti'));
    if (artiMeeting) {
      const { getNotesByDate } = await import('../js/notes.js');
      const artiNotesByDate = await getNotesByDate(artiMeeting.id);
      
      // Create notes for 10 days if we have fewer than 10 days of notes
      if (artiNotesByDate.length < 10) {
        // Create notes for 10 days starting from yesterday
        const sampleNotes = [
          // Yesterday (Day 1)
          ['Discussed project timeline and deliverables. Need to follow up on budget approval.', 'Reviewed Q1 goals and progress. Arti is on track with all milestones.', 'Covered sprint planning and resource allocation. Arti to lead the next standup.', 'Discussed team dynamics and collaboration improvements. We need to schedule a team building session next month.', 'Arti shared concerns about the current sprint velocity. We agreed to review and adjust the sprint planning process.'],
          // Day 2
          ['Followed up on yesterday\'s action items. Budget approval is pending from finance team.', 'Discussed the new feature requirements for the mobile app. Arti will create a detailed spec document.', 'Reviewed the performance metrics from last quarter. We\'re exceeding targets in most areas.', 'Arti mentioned some technical debt that needs attention. We should prioritize this in the next sprint.'],
          // Day 3
          ['Had a deep dive into the architecture changes needed for scalability.', 'Discussed the hiring plan for the next quarter. We need to fill two senior developer positions.', 'Arti presented the results from the user research study. Key insights will inform our product roadmap.', 'We reviewed the security audit findings and prioritized the critical issues.', 'Discussed the team\'s learning and development goals. Arti wants to focus on cloud architecture.'],
          // Day 4
          ['Budget approval came through! We can now proceed with the infrastructure upgrades.', 'Discussed the integration challenges with the third-party API. Need to schedule a technical review.', 'Arti shared feedback from the stakeholder meeting. They\'re happy with our progress but want faster delivery.'],
          // Day 5
          ['Reviewed the sprint retrospective outcomes. Team identified several process improvements.', 'Discussed the upcoming product launch. Arti will coordinate with marketing and sales teams.', 'We talked about work-life balance and team burnout. Need to implement better guardrails.', 'Arti raised concerns about the code review process. We agreed to streamline it.', 'Discussed the quarterly business review preparation. Arti will prepare the technical metrics.'],
          // Day 6
          ['Had a strategic discussion about the product roadmap for next year.', 'Discussed the technical feasibility of the new feature requests from customers.', 'Arti presented a proposal for improving our CI/CD pipeline. Looks promising.', 'We reviewed the team\'s performance and discussed promotion opportunities.'],
          // Day 7
          ['Followed up on the infrastructure upgrade project. Timeline looks good.', 'Discussed the API rate limiting issues we\'ve been experiencing. Need to implement better caching.', 'Arti shared updates from the architecture review meeting. Some changes needed.', 'We talked about the team\'s career development plans. Arti wants to explore leadership opportunities.', 'Discussed the quarterly planning process. We need to align better with other teams.'],
          // Day 8
          ['Reviewed the security audit remediation progress. On track for completion.', 'Discussed the new tooling we need for better monitoring and observability.', 'Arti presented the results from the performance testing. Some optimizations needed.', 'We talked about improving our documentation practices. Team will focus on this.'],
          // Day 9
          ['Had a discussion about the upcoming team offsite. Planning activities and agenda.', 'Discussed the technical debt prioritization. We agreed on the top items to tackle.', 'Arti shared insights from the industry conference she attended. Good learnings.', 'We reviewed the team\'s OKRs and progress. Most are on track.', 'Discussed the hiring process improvements. Need to reduce time-to-hire.'],
          // Day 10
          ['Followed up on last week\'s action items. Most are completed.', 'Discussed the new project proposal. Arti will evaluate technical feasibility.', 'We reviewed the team\'s velocity trends. Need to investigate the recent dip.', 'Arti shared feedback from the customer advisory board meeting. Important insights.', 'Discussed the upcoming performance review cycle. Need to prepare documentation.']
        ];
        
        // Get existing dates to avoid duplicates
        const existingDates = new Set();
        artiNotesByDate.forEach(dateGroup => {
          const date = new Date(dateGroup.date);
          date.setHours(0, 0, 0, 0);
          existingDates.add(date.toISOString());
        });
        
        // Create dates for 10 days starting from yesterday, but only for missing days
        for (let dayOffset = 1; dayOffset <= 10; dayOffset++) {
          const noteDate = new Date(yesterday);
          noteDate.setDate(noteDate.getDate() + (dayOffset - 1));
          noteDate.setHours(0, 0, 0, 0);
          const dateKey = noteDate.toISOString();
          
          // Skip if this date already has notes
          if (existingDates.has(dateKey)) {
            continue;
          }
          
          const dayNotes = sampleNotes[dayOffset - 1] || [];
          
          // Randomly select 3-5 notes for each day
          const numNotes = Math.floor(Math.random() * 3) + 3; // 3-5 notes
          const selectedNotes = dayNotes.slice(0, numNotes);
          
          for (const noteText of selectedNotes) {
            await addNote(artiMeeting.id, noteText, noteDate);
          }
        }
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
  // Help button
  if (elements.helpButton) {
    elements.helpButton.addEventListener('click', () => {
      // TODO: Open help modal/page
      console.log('Help clicked');
    });
  }
  
  // Settings button
  if (elements.settingsButton) {
    elements.settingsButton.addEventListener('click', () => {
      showSettingsView();
    });
  }
  
  // Settings back button
  if (elements.settingsBackButton) {
    elements.settingsBackButton.addEventListener('click', () => {
      hideSettingsView();
    });
  }
  
  // Settings license key input
  if (elements.settingsProductKeyInput) {
    // Load existing license
    (async () => {
      const license = await licenseManager.loadLicense();
      if (license && license.license_key) {
        elements.settingsProductKeyInput.value = license.license_key;
      }
      await updateLicenseStatusDisplay();
    })();
    
    // Save on blur/enter
    elements.settingsProductKeyInput.addEventListener('blur', () => {
      handleLicenseKeyChange();
    });
    
    elements.settingsProductKeyInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleLicenseKeyChange();
      }
    });
  }
  
  // Settings name input
  if (elements.settingsNameInput) {
    (async () => {
      const saved = await chrome.storage.local.get('user_name');
      if (saved.user_name) {
        elements.settingsNameInput.value = saved.user_name;
      }
    })();
    
    elements.settingsNameInput.addEventListener('blur', () => {
      chrome.storage.local.set({ user_name: elements.settingsNameInput.value });
    });
  }

  // Header tabs
  if (elements.meetingsTab) {
    elements.meetingsTab.addEventListener('click', () => {
      // If settings view is open, close it first
      if (elements.settingsView && elements.settingsView.style.display === 'flex') {
        hideSettingsView();
      }
      
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
      // If settings view is open, close it first
      if (elements.settingsView && elements.settingsView.style.display === 'flex') {
        hideSettingsView();
      }
      
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
  
  // Agenda input - auto-resize and handle Enter/Shift+Enter
  if (elements.agendaInput) {
    // Auto-resize textarea
    const autoResize = (textarea) => {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 200); // Max height 200px
      textarea.style.height = newHeight + 'px';
    };
    
    elements.agendaInput.addEventListener('input', (e) => {
      autoResize(e.target);
    });
    
    elements.agendaInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (e.target.value.trim() && state.currentMeetingId) {
        await createAgendaItem(state.currentMeetingId, e.target.value.trim());
        e.target.value = '';
          e.target.style.height = 'auto';
        await loadAgenda();
        // Update meeting badge in sidebar
        if (state.currentMeetingId) {
          await updateMeetingBadge(state.currentMeetingId);
        }
        await updateCounts(elements);
          // Refocus and reset height
          setTimeout(() => {
            elements.agendaInput.focus();
            autoResize(elements.agendaInput);
          }, 50);
        }
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
        
        // Auto-focus agenda input when switching to 'all' or 'open' filter
        if (state.currentAgendaFilter === 'all' || state.currentAgendaFilter === 'open') {
          const agendaInput = document.getElementById('agenda-input');
          if (agendaInput) {
            setTimeout(() => {
              agendaInput.focus();
            }, 100);
          }
        }
        
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
        
        // Auto-focus action input when switching to 'all' or 'open' filter
        if (state.currentActionFilter === 'all' || state.currentActionFilter === 'open') {
          const actionsInput = document.getElementById('actions-input');
          if (actionsInput) {
            setTimeout(() => {
              actionsInput.focus();
            }, 100);
          }
        }
        
        await saveState(elements);
      });
    });
  }
  
  // Actions input (for meeting-specific actions) - auto-resize and handle Enter/Shift+Enter
  if (elements.actionsInput) {
    // Auto-resize textarea
    const autoResize = (textarea) => {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 200); // Max height 200px
      textarea.style.height = newHeight + 'px';
    };
    
    // Save input value on change
    elements.actionsInput.addEventListener('input', (e) => {
      autoResize(e.target);
      if (state.currentMeetingId) {
        state.actionInputValues[state.currentMeetingId] = e.target.value;
      }
    });
    
    elements.actionsInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (e.target.value.trim() && state.currentMeetingId) {
        const text = e.target.value.trim();
        e.target.value = '';
          e.target.style.height = 'auto';
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
          
          // Refocus and reset height
          setTimeout(() => {
            elements.actionsInput.focus();
            autoResize(elements.actionsInput);
          }, 50);
        }
      }
    });
  }
  
  // Function to update clear button visibility
  function updateSearchClearButton() {
    const searchInput = elements.consolidatedActionsSearchInput;
    const clearButton = document.getElementById('consolidated-actions-search-clear');
    
    if (searchInput && clearButton) {
      if (searchInput.value.trim()) {
        clearButton.style.display = 'flex';
      } else {
        clearButton.style.display = 'none';
      }
    }
  }
  
  // Consolidated actions filters
  if (elements.consolidatedActionsFilters && elements.consolidatedActionsFilters.length > 0) {
    elements.consolidatedActionsFilters.forEach(filter => {
      filter.addEventListener('click', () => {
        elements.consolidatedActionsFilters.forEach(f => f.classList.remove('active'));
        filter.classList.add('active');
        state.currentActionFilter = filter.dataset.filter;
        
        // Clear search when switching tabs
        state.currentActionSearchQuery = '';
        if (elements.consolidatedActionsSearchInput) {
          elements.consolidatedActionsSearchInput.value = '';
        }
        // Hide clear button when search is cleared
        updateSearchClearButton();
        
        loadConsolidatedActions();
      });
    });
  }
  
  // Consolidated actions search input - filter on input and show clear button
  if (elements.consolidatedActionsSearchInput) {
    // Initialize clear button state
    updateSearchClearButton();
    
    // Update search query on input (real-time search)
    elements.consolidatedActionsSearchInput.addEventListener('input', (e) => {
      state.currentActionSearchQuery = e.target.value;
      updateSearchClearButton();
      loadConsolidatedActions();
    });
    
    // Also handle Enter key
    elements.consolidatedActionsSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        state.currentActionSearchQuery = e.target.value;
        updateSearchClearButton();
        loadConsolidatedActions();
      }
    });
  }
  
  // Clear search button click handler
  const clearSearchButton = document.getElementById('consolidated-actions-search-clear');
  if (clearSearchButton) {
    clearSearchButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (elements.consolidatedActionsSearchInput) {
        elements.consolidatedActionsSearchInput.value = '';
        state.currentActionSearchQuery = '';
        updateSearchClearButton();
        loadConsolidatedActions();
        elements.consolidatedActionsSearchInput.focus();
      }
    });
  }
  
  // Show More button click handler (consolidated actions) - use event delegation since button is created dynamically
  document.addEventListener('click', async (e) => {
    if (e.target.closest('#consolidated-actions-show-more .actions-show-more-button')) {
      e.preventDefault();
      await handleShowMore();
    }
  });
  
  // Show More button click handler (notes) - use event delegation since button is created dynamically
  document.addEventListener('click', async (e) => {
    if (e.target.closest('#notes-show-more .notes-show-more-button')) {
      e.preventDefault();
      await handleShowMoreNotes();
    }
  });
  
  // Show More button click handler (agenda) - use event delegation since button is created dynamically
  document.addEventListener('click', async (e) => {
    if (e.target.closest('#agenda-show-more .agenda-show-more-button')) {
      e.preventDefault();
      await handleShowMoreAgenda();
    }
  });
  
  // Show More button click handler (actions) - use event delegation since button is created dynamically
  document.addEventListener('click', async (e) => {
    if (e.target.closest('#actions-show-more .actions-show-more-button')) {
      e.preventDefault();
      await handleShowMoreActions();
    }
  });
  
  // Meeting title edit functionality
  if (elements.meetingTitleEdit) {
    elements.meetingTitleEdit.addEventListener('click', async (e) => {
      e.stopPropagation();
      await startEditingMeetingTitle();
    });
  }
}

// Start editing meeting title
async function startEditingMeetingTitle() {
  const titleElement = elements.meetingTitle;
  if (!titleElement || !state.currentMeetingId) return;
  
  const currentText = titleElement.textContent;
  const isEditing = titleElement.classList.contains('editing');
  
  if (isEditing) return; // Already editing
  
  // Make it editable
  titleElement.contentEditable = true;
  titleElement.classList.add('editing');
  titleElement.textContent = currentText;
  
  // Focus and select all text
  titleElement.focus();
  const range = document.createRange();
  range.selectNodeContents(titleElement);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  
  // Handle save on blur or Enter
  const saveTitle = async () => {
    const newText = titleElement.textContent.trim();
    if (newText && newText !== currentText && state.currentMeetingId) {
      const { getMeetingSeries } = await import('../js/meetings.js');
      const { db } = await import('../js/db.js');
      await db.meetingSeries.update(state.currentMeetingId, { name: newText });
      
      // Reload meetings to update sidebar
      const { loadMeetings } = await import('../js/modules/sidebar.js');
      await loadMeetings(elements);
      
      // Update title display
      titleElement.textContent = newText;
    } else {
      titleElement.textContent = currentText;
    }
    
    titleElement.contentEditable = false;
    titleElement.classList.remove('editing');
  };
  
  const handleKeyDown = async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      titleElement.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      titleElement.textContent = currentText;
      titleElement.blur();
    }
  };
  
  titleElement.addEventListener('blur', saveTitle, { once: true });
  titleElement.addEventListener('keydown', handleKeyDown);
  
  // Remove keydown listener after blur
  titleElement.addEventListener('blur', () => {
    titleElement.removeEventListener('keydown', handleKeyDown);
  }, { once: true });
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

// Show settings view
async function showSettingsView() {
  if (elements.settingsView) {
    elements.settingsView.style.display = 'flex';
  }
  // Hide main content (but keep header visible)
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    mainContent.style.display = 'none';
  }
  // Mark settings button as selected and toggle icons
  if (elements.settingsButton) {
    elements.settingsButton.classList.add('selected');
    const unselectedIcon = elements.settingsButton.querySelector('.settings-icon-unselected');
    const selectedIcon = elements.settingsButton.querySelector('.settings-icon-selected');
    if (unselectedIcon) unselectedIcon.style.display = 'none';
    if (selectedIcon) selectedIcon.style.display = 'block';
  }
  
  // Small delay to ensure DOM is ready
  setTimeout(async () => {
    // Update license status display
    await updateLicenseStatusDisplay();
  }, 100);
}

// Hide settings view
function hideSettingsView() {
  if (elements.settingsView) {
    elements.settingsView.style.display = 'none';
  }
  // Show main content
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    mainContent.style.display = 'flex';
  }
  // Remove selected state from settings button and toggle icons
  if (elements.settingsButton) {
    elements.settingsButton.classList.remove('selected');
    const unselectedIcon = elements.settingsButton.querySelector('.settings-icon-unselected');
    const selectedIcon = elements.settingsButton.querySelector('.settings-icon-selected');
    if (unselectedIcon) unselectedIcon.style.display = 'block';
    if (selectedIcon) selectedIcon.style.display = 'none';
  }
}

// Handle license key change
async function handleLicenseKeyChange() {
  const licenseKey = elements.settingsProductKeyInput.value.trim();
  const email = elements.settingsNameInput.value.trim() || 'user@example.com';
  
  if (!licenseKey) {
    // Clear license if empty
    await licenseManager.clearLicense();
    await updateLicenseStatusDisplay();
    return;
  }
  
  // Show loading state (you can add a loading indicator here)
  const input = elements.settingsProductKeyInput;
  const originalBorder = input.style.borderColor;
  input.style.borderColor = '#f59e0b'; // Orange border for loading
  
  // Activate license
  const result = await licenseManager.activateLicense(email, licenseKey);
  
  if (result.success) {
    await updateLicenseStatusDisplay();
    // Show success state
    input.style.borderColor = '#008236'; // Green border for success
    setTimeout(() => {
      input.style.borderColor = originalBorder;
    }, 2000);
    console.log('License activated successfully');
  } else {
    // Show error state
    input.style.borderColor = '#c10007'; // Red border for error
    setTimeout(() => {
      input.style.borderColor = originalBorder;
    }, 3000);
    
    // Show error message
    console.error('License activation failed:', result.error);
    
    // Display error to user
    showLicenseError(result.error);
  }
}

// Show license error message
function showLicenseError(message) {
  // Remove existing error message
  const existingError = document.getElementById('license-error-message');
  if (existingError) {
    existingError.remove();
  }
  
  // Create error message element
  const errorDiv = document.createElement('div');
  errorDiv.id = 'license-error-message';
  errorDiv.className = 'license-error-message';
  errorDiv.textContent = message;
  
  // Insert after license key input
  const licenseField = elements.settingsProductKeyInput?.parentElement;
  if (licenseField) {
    licenseField.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (errorDiv.parentElement) {
        errorDiv.remove();
      }
    }, 5000);
  }
}

// Update license status display
async function updateLicenseStatusDisplay() {
  try {
    console.log('[Settings] updateLicenseStatusDisplay called');
    
    // Always re-initialize elements when Settings view is shown (in case DOM wasn't ready before)
    elements.licenseStatusActive = document.getElementById('license-status-active');
    elements.licenseStatusExpired = document.getElementById('license-status-expired');
    elements.licenseExpiryText = document.getElementById('license-expiry-text');
    elements.licenseExpiredText = document.getElementById('license-expired-text');
    elements.freeTrialStatusActive = document.getElementById('free-trial-status-active');
    elements.freeTrialStatusExpired = document.getElementById('free-trial-status-expired');
    elements.freeTrialActiveText = document.getElementById('free-trial-active-text');
    elements.freeTrialExpiredText = document.getElementById('free-trial-expired-text');
    
    console.log('[Settings] Elements found:', {
      licenseStatusActive: !!elements.licenseStatusActive,
      licenseStatusExpired: !!elements.licenseStatusExpired,
      freeTrialStatusActive: !!elements.freeTrialStatusActive,
      freeTrialStatusExpired: !!elements.freeTrialStatusExpired,
      freeTrialActiveText: !!elements.freeTrialActiveText,
      freeTrialExpiredText: !!elements.freeTrialExpiredText
    });
    
    // If elements still don't exist, skip (Settings view might not be in DOM)
    if (!elements.licenseStatusActive || !elements.licenseStatusExpired) {
      console.warn('[Settings] Required elements not found, skipping status display');
      return;
    }
    
    const status = await licenseManager.getLicenseStatus();
    console.log('[Settings] License status:', status);
    
    // Hide all status boxes initially
    elements.licenseStatusActive.style.display = 'none';
    elements.licenseStatusExpired.style.display = 'none';
    if (elements.freeTrialStatusActive) {
      elements.freeTrialStatusActive.style.display = 'none';
    }
    if (elements.freeTrialStatusExpired) {
      elements.freeTrialStatusExpired.style.display = 'none';
    }
    
    // Show appropriate status box
    if (status.status === 'active') {
      // Paid license active
      console.log('[Settings] Showing paid license active');
      if (elements.licenseExpiryText) {
        elements.licenseExpiryText.textContent = status.message;
      }
      elements.licenseStatusActive.style.display = 'block';
    } else if (status.status === 'expired') {
      // Paid license expired
      console.log('[Settings] Showing paid license expired');
      if (elements.licenseExpiredText) {
        elements.licenseExpiredText.textContent = status.message;
      }
      elements.licenseStatusExpired.style.display = 'block';
    } else if (status.status === 'free_trial') {
      // Free trial active
      console.log('[Settings] Showing free trial active - Days remaining:', status.daysRemaining);
      if (elements.freeTrialStatusActive && elements.freeTrialActiveText) {
        // Use the message from getLicenseStatus which includes expiry date
        elements.freeTrialActiveText.textContent = status.message;
        elements.freeTrialStatusActive.style.display = 'block';
        console.log('[Settings] Free trial box displayed with message:', status.message);
      } else {
        console.warn('[Settings] Free trial elements not found:', {
          freeTrialStatusActive: !!elements.freeTrialStatusActive,
          freeTrialActiveText: !!elements.freeTrialActiveText
        });
      }
    } else if (status.status === 'none') {
      // Free trial expired, no license
      console.log('[Settings] Showing free trial expired');
      if (elements.freeTrialStatusExpired && elements.freeTrialExpiredText) {
        // Calculate when trial expired
        const installDate = await licenseManager.getInstallDate();
        const trialEndDate = new Date(installDate);
        // Use 7 days (matching FREE_TRIAL_DAYS constant in license.js)
        trialEndDate.setDate(trialEndDate.getDate() + 7);
        const now = new Date();
        // Calculate days expired: if trialEndDate is in past, (now - trialEndDate) is positive
        // If somehow trialEndDate is in future, use absolute value and show 0
        const daysExpired = Math.max(0, Math.floor((now - trialEndDate) / (1000 * 60 * 60 * 24)));
        // Format date manually
        const formattedDate = trialEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        // Only show expired message if trial actually expired (trialEndDate is in past)
        if (trialEndDate < now) {
          elements.freeTrialExpiredText.textContent = `Expired on ${formattedDate} (${daysExpired} days ago). Enter a license key to continue.`;
        } else {
          // This shouldn't happen if status is 'none', but handle edge case
          elements.freeTrialExpiredText.textContent = `Free trial expired. Enter a license key to continue.`;
        }
        elements.freeTrialStatusExpired.style.display = 'block';
        console.log('[Settings] Free trial expired box displayed - Install date:', installDate.toISOString(), 'Trial ended:', formattedDate, 'Days expired:', daysExpired);
      } else {
        console.warn('[Settings] Free trial expired elements not found');
      }
    } else {
      console.warn('[Settings] Unknown status:', status.status);
    }
  } catch (error) {
    console.error('[Settings] Error updating license status display:', error);
    console.error('[Settings] Error stack:', error.stack);
  }
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
  });
} else {
  init();
}
