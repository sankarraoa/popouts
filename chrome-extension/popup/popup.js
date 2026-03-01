// Main sidepanel JavaScript - Refactored with ES6 modules

// Import modules
import { state, saveState, restoreState } from '../js/modules/state.js';
import { updateCounts } from '../js/modules/utils.js';
import { loadMeetings, initSidebar } from '../js/modules/sidebar.js';
import { loadAgenda, setAgendaDependencies, handleShowMoreAgenda } from '../js/modules/agenda-tab.js';
import { loadNotes, setNotesDependencies, handleShowMoreNotes } from '../js/modules/notes-tab.js';
import { loadActions, setActionsDependencies, createActionItemElement, handleShowMoreActions } from '../js/modules/actions-tab.js';
import { selectMeeting, switchView, setMeetingViewDependencies } from '../js/modules/meeting-view.js';
import { createAgendaItem } from '../js/agenda.js';
import { updateMeetingBadge } from '../js/modules/sidebar.js';
import { createActionItem } from '../js/actions.js';
import { db } from '../js/db.js';
import { actionExtractionService } from '../js/modules/action-extraction.js';
import { getConfig, getEnv, setEnv } from '../js/config.js';

// Make state available globally for extraction service
window.state = state;

// Make settings function available globally
window.showSettingsView = showSettingsView;

// DOM Elements - will be populated after DOM is ready
const elements = {};
let deferredHydrationScheduled = false;
const PERF_DEBUG = false;

// Lazy-loaded consolidated actions module (loaded when user clicks Actions tab)
let consolidatedActionsModule = null;

async function getConsolidatedActionsModule() {
  if (!consolidatedActionsModule) {
    consolidatedActionsModule = await import('../js/modules/consolidated-actions.js');
  }
  return consolidatedActionsModule;
}

async function ensureConsolidatedActionsReady() {
  const mod = await getConsolidatedActionsModule();
  mod.setConsolidatedActionsDependencies(elements, async () => await updateCounts(elements));
  setActionsDependencies(elements, async () => await updateCounts(elements), () => mod.loadConsolidatedActions());
  return mod;
}

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
  
  elements.sidebarSearchInput = document.getElementById('sidebar-search-input');
  elements.extractionStatusBar = document.getElementById('extraction-status-bar');
  elements.settingsButton = document.getElementById('settings-button');
  elements.helpButton = document.getElementById('help-button');
  elements.settingsView = document.getElementById('settings-view');
  elements.settingsBackButton = document.getElementById('settings-back-button');
  elements.settingsNameInput = document.getElementById('settings-name-input');
  elements.settingsLicenseEmailInput = document.getElementById('settings-license-email-input');
  elements.settingsProductKeyInput = document.getElementById('settings-product-key-input');
  elements.settingsExportDataButton = document.getElementById('settings-export-data-button');
  elements.settingsImportDataButton = document.getElementById('settings-import-data-button');
  elements.settingsImportFileInput = document.getElementById('settings-import-file-input');
  elements.settingsDataTransferStatus = document.getElementById('settings-data-transfer-status');
  // License status elements - will be initialized when Settings view is shown
  // (they might not exist in DOM until Settings view is displayed)
  elements.licenseStatusActive = document.getElementById('license-status-active');
  elements.licenseStatusExpired = document.getElementById('license-status-expired');
  elements.licenseExpiryText = document.getElementById('license-expiry-text');
  elements.licenseExpiredText = document.getElementById('license-expired-text');
}

// Initialize
async function init() {
  const t0 = performance.now();
  const mark = (label) => {
    if (PERF_DEBUG) {
      console.log(`[Perf] ${label}: ${Math.round(performance.now() - t0)}ms`);
    }
  };
  
  try {
    initializeElements();
    mark('Elements initialized');
    
    setupCriticalEventListeners();
    mark('Critical listeners setup');
    
    await db.ensureReady();
    mark('Database ready');
    
    const updateCountsWithElements = async () => await updateCounts(elements);
    setAgendaDependencies(elements, updateCountsWithElements);
    setNotesDependencies(elements, updateCountsWithElements);
    setActionsDependencies(elements, updateCountsWithElements, async () => {
      if (consolidatedActionsModule) await consolidatedActionsModule.loadConsolidatedActions();
    });
    setMeetingViewDependencies(elements, updateCountsWithElements);
    initSidebar(elements, { 
      selectMeeting, 
      updateCounts: updateCountsWithElements, 
      saveState: async () => await saveState(elements), 
      loadMeetings: async () => await loadMeetings(elements) 
    });
    mark('Dependencies wired');
    
    // Load meetings first so UI has content to show
    await loadMeetings(elements);
    mark('Meetings loaded');
    
    // Restore state (re-selects meeting, switches view)
    await restoreState(elements);
    mark('State restored');
    
    // Update header counts
    await updateCounts(elements);
    mark('Counts updated');
    
    if (PERF_DEBUG) {
      console.log(`[Perf] UI ready: ${Math.round(performance.now() - t0)}ms`);
    }
    scheduleDeferredHydration();
    
    // Everything below is non-blocking — UI is already visible
    actionExtractionService.init(elements.extractionStatusBar);
    // Run extraction for ALL meetings on load (migrate stuck notes, then extract not_actioned/action_failed)
    actionExtractionService.runExtractionOnLoad().catch(err => {
      console.error('[ActionExtraction] Error on load:', err);
    });
    
  } catch (error) {
    console.error('Error in init():', error);
  }
}

// Setup event listeners
function setupCriticalEventListeners() {
  // Help button - opens help page on website
  if (elements.helpButton) {
    elements.helpButton.addEventListener('click', async () => {
      const cfg = await getConfig();
      const helpUrl = `${cfg.WEBSITE_URL}/help.html`;
      chrome.tabs.create({ url: helpUrl });
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
  
  // Header tabs
  if (elements.meetingsTab) {
    elements.meetingsTab.addEventListener('click', async () => {
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
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) sidebar.style.display = 'flex';
      // Restore previously selected meeting if any
      if (state.currentMeetingId) {
        await selectMeeting(state.currentMeetingId);
      } else {
        if (elements.emptyState) elements.emptyState.style.display = 'flex';
        if (elements.meetingDetail) elements.meetingDetail.style.display = 'none';
      }
    });
  }
  
  if (elements.actionsTab) {
    elements.actionsTab.addEventListener('click', async () => {
      // If settings view is open, close it first
      if (elements.settingsView && elements.settingsView.style.display === 'flex') {
        hideSettingsView();
      }
      
      elements.actionsTab.classList.add('active');
      elements.meetingsTab.classList.remove('active');
      // Show consolidated actions view
      if (elements.consolidatedActionsView) {
        elements.consolidatedActionsView.style.display = 'flex';
      }
      if (elements.emptyState) elements.emptyState.style.display = 'none';
      if (elements.meetingDetail) elements.meetingDetail.style.display = 'none';
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) sidebar.style.display = 'none';
      const mod = await ensureConsolidatedActionsReady();
      await mod.loadConsolidatedActions();
    });
  }
}

function scheduleDeferredHydration() {
  if (deferredHydrationScheduled) return;
  deferredHydrationScheduled = true;

  // Let first paint happen before binding non-critical listeners and data reads.
  requestAnimationFrame(() => {
    setTimeout(() => {
      setupDeferredEventListeners();
    }, 0);
  });
}

function setupDeferredEventListeners() {
  // Sidebar meeting search
  if (elements.sidebarSearchInput) {
    elements.sidebarSearchInput.addEventListener('input', () => {
      filterMeetingsBySearch(elements.sidebarSearchInput.value);
    });
  }

  // Developer mode: tap Settings title 5 times to reveal environment selector
  const settingsTitle = document.querySelector('.settings-title');
  if (settingsTitle) {
    let devTapCount = 0;
    let devTapTimer = null;
    settingsTitle.addEventListener('click', () => {
      devTapCount++;
      clearTimeout(devTapTimer);
      devTapTimer = setTimeout(() => { devTapCount = 0; }, 2000);
      if (devTapCount >= 5) {
        devTapCount = 0;
        const envField = document.getElementById('settings-env-field');
        if (envField) {
          const isHidden = envField.style.display === 'none';
          envField.style.display = isHidden ? 'flex' : 'none';
        }
      }
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
  
  // Add Action button - show add action input section (lazy-loads consolidated-actions)
  const consolidatedAddButton = document.getElementById('consolidated-actions-add-button');
  if (consolidatedAddButton) {
    consolidatedAddButton.addEventListener('click', async () => {
      const mod = await ensureConsolidatedActionsReady();
      mod.showAddActionSection();
    });
  }
  
  if (elements.actionsAddButton) {
    elements.actionsAddButton.addEventListener('click', async () => {
      const mod = await ensureConsolidatedActionsReady();
      mod.showAddActionSection();
    });
  }
  
  // Add Action input handlers (lazy-loads consolidated-actions)
  if (elements.addActionInput) {
    const autoResizeAddAction = (textarea) => {
      textarea.style.height = 'auto';
      const lineHeight = 18;
      const maxHeight = lineHeight * 3;
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    };

    elements.addActionInput.addEventListener('input', (e) => {
      autoResizeAddAction(e.target);
    });

    elements.addActionInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const mod = await ensureConsolidatedActionsReady();
        await mod.handleAddAction();
      } else if (e.key === 'Enter' && e.shiftKey) {
        requestAnimationFrame(() => autoResizeAddAction(e.target));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        const mod = await ensureConsolidatedActionsReady();
        mod.hideAddActionSection();
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
  
  // Consolidated actions filters (lazy-loads consolidated-actions)
  if (elements.consolidatedActionsFilters && elements.consolidatedActionsFilters.length > 0) {
    elements.consolidatedActionsFilters.forEach(filter => {
      filter.addEventListener('click', async () => {
        elements.consolidatedActionsFilters.forEach(f => f.classList.remove('active'));
        filter.classList.add('active');
        state.currentActionFilter = filter.dataset.filter;
        
        // Clear search when switching tabs
        state.currentActionSearchQuery = '';
        if (elements.consolidatedActionsSearchInput) {
          elements.consolidatedActionsSearchInput.value = '';
        }
        updateSearchClearButton();
        
        const mod = await ensureConsolidatedActionsReady();
        await mod.loadConsolidatedActions();
      });
    });
  }
  
  // Consolidated actions search input (lazy-loads consolidated-actions)
  if (elements.consolidatedActionsSearchInput) {
    updateSearchClearButton();
    
    elements.consolidatedActionsSearchInput.addEventListener('input', async (e) => {
      state.currentActionSearchQuery = e.target.value;
      updateSearchClearButton();
      const mod = await ensureConsolidatedActionsReady();
      await mod.loadConsolidatedActions();
    });
    
    elements.consolidatedActionsSearchInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        state.currentActionSearchQuery = e.target.value;
        updateSearchClearButton();
        const mod = await ensureConsolidatedActionsReady();
        await mod.loadConsolidatedActions();
      }
    });
  }
  
  // Clear search button click handler (lazy-loads consolidated-actions)
  const clearSearchButton = document.getElementById('consolidated-actions-search-clear');
  if (clearSearchButton) {
    clearSearchButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (elements.consolidatedActionsSearchInput) {
        elements.consolidatedActionsSearchInput.value = '';
        state.currentActionSearchQuery = '';
        updateSearchClearButton();
        const mod = await ensureConsolidatedActionsReady();
        await mod.loadConsolidatedActions();
        elements.consolidatedActionsSearchInput.focus();
      }
    });
  }
  
  // Show More button click handler (consolidated actions) - use event delegation, lazy-loads
  document.addEventListener('click', async (e) => {
    if (e.target.closest('#consolidated-actions-show-more .actions-show-more-button')) {
      e.preventDefault();
      const mod = await ensureConsolidatedActionsReady();
      await mod.handleShowMore();
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

// Filter meeting items in sidebar by search query
function filterMeetingsBySearch(query) {
  const q = (query || '').trim().toLowerCase();
  const meetingItems = document.querySelectorAll('.meeting-item');
  const categorySections = document.querySelectorAll('.category-section');

  meetingItems.forEach(item => {
    const nameEl = item.querySelector('.meeting-item-name');
    const name = nameEl ? nameEl.textContent.toLowerCase() : '';
    item.style.display = (!q || name.includes(q)) ? '' : 'none';
  });

  // Show/hide entire category sections based on whether any visible items remain
  categorySections.forEach(section => {
    const visibleItems = section.querySelectorAll('.meeting-item:not([style*="display: none"])');
    const categoryHeader = section.querySelector('.category-header');
    const meetingList = section.querySelector('.meeting-list');

    if (q && visibleItems.length === 0) {
      if (categoryHeader) categoryHeader.style.display = 'none';
      if (meetingList) meetingList.style.display = 'none';
    } else {
      if (categoryHeader) categoryHeader.style.display = '';
      if (meetingList) meetingList.style.display = '';
    }
  });
}

// Show settings view (lazy-loads settings module on first open)
async function showSettingsView() {
  const settings = await import('../js/modules/settings-view.js');
  await settings.displaySettingsView(elements, {
    onExport: () => handleExportData(),
    onImportClick: () => handleImportDataClick(),
    onImportFileSelected: () => handleImportDataFileSelected(),
  });
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

function setDataTransferStatus(message, type = 'info') {
  if (!elements.settingsDataTransferStatus) {
    return;
  }

  elements.settingsDataTransferStatus.textContent = message;
  elements.settingsDataTransferStatus.classList.remove('success', 'error');
  if (type === 'success' || type === 'error') {
    elements.settingsDataTransferStatus.classList.add(type);
  }
  elements.settingsDataTransferStatus.style.display = message ? 'block' : 'none';
}

function setDataTransferBusy(isBusy) {
  if (elements.settingsExportDataButton) {
    elements.settingsExportDataButton.disabled = isBusy;
  }
  if (elements.settingsImportDataButton) {
    elements.settingsImportDataButton.disabled = isBusy;
  }
}

async function handleExportData() {
  try {
    setDataTransferBusy(true);
    setDataTransferStatus('Preparing export...', 'info');

    await db.ensureReady();
    const [meetingSeries, meetingInstances, agendaItems, actionItems] = await Promise.all([
      db.meetingSeries.toArray(),
      db.meetingInstances.toArray(),
      db.agendaItems.toArray(),
      db.actionItems.toArray()
    ]);

    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      source: 'popouts-sidepanel',
      data: {
        meetingSeries,
        meetingInstances,
        agendaItems,
        actionItems
      }
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');

    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `popouts-export-${stamp}.json`;
    downloadLink.click();
    URL.revokeObjectURL(url);

    setDataTransferStatus(
      `Exported ${meetingSeries.length} meetings, ${meetingInstances.length} instances, ${agendaItems.length} agenda items, and ${actionItems.length} action items.`,
      'success'
    );
  } catch (error) {
    console.error('Error exporting data:', error);
    setDataTransferStatus('Export failed. Please try again.', 'error');
  } finally {
    setDataTransferBusy(false);
  }
}

function handleImportDataClick() {
  if (!elements.settingsImportFileInput) {
    setDataTransferStatus('Import input not available.', 'error');
    return;
  }

  elements.settingsImportFileInput.value = '';
  elements.settingsImportFileInput.click();
}

async function handleImportDataFileSelected() {
  const fileInput = elements.settingsImportFileInput;
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    return;
  }

  const [file] = fileInput.files;
  if (!file.name.toLowerCase().endsWith('.json')) {
    setDataTransferStatus('Please select a valid JSON file.', 'error');
    return;
  }

  try {
    setDataTransferBusy(true);
    setDataTransferStatus('Importing data...', 'info');

    const text = await file.text();
    const parsed = JSON.parse(text);
    const result = await importDataPayload(parsed);

    await loadMeetings(elements);
    await updateCounts(elements);

    setDataTransferStatus(
      `Imported ${result.meetingSeries} meetings, ${result.meetingInstances} instances, ${result.agendaItems} agenda items, and ${result.actionItems} action items.`,
      'success'
    );
  } catch (error) {
    console.error('Error importing data:', error);
    const msg = error?.message || error?.name || String(error);
    setDataTransferStatus(`Import failed: ${msg}. Ensure the JSON format matches a Popouts export.`, 'error');
  } finally {
    setDataTransferBusy(false);
    if (fileInput) {
      fileInput.value = '';
    }
  }
}

function normalizeDateValue(value) {
  if (value === undefined || value === null || value === '') {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed;
}

function normalizeRecordDates(record, dateFields) {
  const normalized = { ...record };
  for (const field of dateFields) {
    if (field in normalized) {
      normalized[field] = normalizeDateValue(normalized[field]);
    }
  }
  return normalized;
}

async function importDataPayload(payload) {
  const data = payload?.data || payload || {};
  const meetingSeries = Array.isArray(data.meetingSeries) ? data.meetingSeries : [];
  const meetingInstances = Array.isArray(data.meetingInstances) ? data.meetingInstances : [];
  const agendaItems = Array.isArray(data.agendaItems) ? data.agendaItems : [];
  const actionItems = Array.isArray(data.actionItems) ? data.actionItems : [];

  const seriesIdMap = new Map();
  const instanceIdMap = new Map();
  const importedCounts = {
    meetingSeries: 0,
    meetingInstances: 0,
    agendaItems: 0,
    actionItems: 0
  };

  await db.ensureReady();
  await db.transaction('rw', db.meetingSeries, db.meetingInstances, db.agendaItems, db.actionItems, async () => {
    for (const rawSeries of meetingSeries) {
      const { id: originalSeriesId, ...seriesWithoutId } = rawSeries || {};
      const seriesToInsert = normalizeRecordDates(seriesWithoutId, ['createdAt']);
      const newSeriesId = await db.meetingSeries.add(seriesToInsert);
      if (originalSeriesId !== undefined && originalSeriesId !== null) {
        seriesIdMap.set(originalSeriesId, newSeriesId);
      }
      importedCounts.meetingSeries += 1;
    }

    for (const rawInstance of meetingInstances) {
      const { id: originalInstanceId, ...instanceWithoutId } = rawInstance || {};
      const mappedSeriesId = seriesIdMap.get(instanceWithoutId.seriesId);
      if (mappedSeriesId === undefined) {
        continue;
      }

      const instanceToInsert = normalizeRecordDates(
        { ...instanceWithoutId, seriesId: mappedSeriesId },
        ['date', 'createdAt', 'extractedAt']
      );
      const newInstanceId = await db.meetingInstances.add(instanceToInsert);
      if (originalInstanceId !== undefined && originalInstanceId !== null) {
        instanceIdMap.set(originalInstanceId, newInstanceId);
      }
      importedCounts.meetingInstances += 1;
    }

    for (const rawAgenda of agendaItems) {
      const { id: _unusedAgendaId, ...agendaWithoutId } = rawAgenda || {};
      const mappedSeriesId = seriesIdMap.get(agendaWithoutId.seriesId);
      if (mappedSeriesId === undefined) {
        continue;
      }

      const agendaToInsert = normalizeRecordDates(
        { ...agendaWithoutId, seriesId: mappedSeriesId },
        ['createdAt', 'closedAt']
      );
      await db.agendaItems.add(agendaToInsert);
      importedCounts.agendaItems += 1;
    }

    for (const rawAction of actionItems) {
      const { id: _unusedActionId, ...actionWithoutId } = rawAction || {};
      const mappedSeriesId = seriesIdMap.get(actionWithoutId.seriesId);
      if (mappedSeriesId === undefined) {
        continue;
      }

      const mappedInstanceId = actionWithoutId.instanceId
        ? instanceIdMap.get(actionWithoutId.instanceId) || null
        : null;

      const actionToInsert = normalizeRecordDates(
        {
          ...actionWithoutId,
          seriesId: mappedSeriesId,
          instanceId: mappedInstanceId
        },
        ['dueDate', 'createdAt', 'closedAt']
      );
      await db.actionItems.add(actionToInsert);
      importedCounts.actionItems += 1;
    }
  });

  return importedCounts;
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
  });
} else {
  init();
}
