// State management and persistence

// Shared state object
export const state = {
  currentMeetingId: null,
  currentView: 'agenda',
  currentAgendaFilter: 'all',
  currentActionFilter: 'all',
  currentActionSearchQuery: '',
  selectedMeetingForAction: null,
  actionInputValues: {} // Store action input values per meeting
};

// State persistence functions
export async function saveState(elements) {
  try {
    // Get expanded categories
    const expandedCategories = [];
    elements.categoryToggles.forEach(toggle => {
      if (toggle.classList.contains('active')) {
        expandedCategories.push(toggle.dataset.category);
      }
    });
    
    const savedState = {
      expandedCategories,
      selectedMeetingId: state.currentMeetingId,
      currentView: state.currentView,
      currentAgendaFilter: state.currentAgendaFilter,
      currentActionFilter: state.currentActionFilter,
      actionInputValues: state.actionInputValues
    };
    
    await chrome.storage.local.set({ popupState: savedState });
    console.log('State saved:', savedState);
  } catch (error) {
    console.error('Error saving state:', error);
  }
}

export async function restoreState(elements) {
  try {
    const result = await chrome.storage.local.get(['popupState']);
    const savedState = result.popupState;
    
    if (!savedState) {
      // First time - set default state
      console.log('No saved state, using defaults');
      // Expand 1:1s category by default
      const categoryToggle = document.querySelector('.category-toggle[data-category="1:1s"]');
      if (categoryToggle) {
        categoryToggle.classList.add('active');
        const list = document.querySelector('.meeting-list[data-category="1:1s"]');
        const icon = categoryToggle.querySelector('.category-icon');
        if (list) list.style.display = 'flex';
        if (icon) {
          icon.innerHTML = '<img src="../icons/category-open-icon.png?v=' + Date.now() + '" alt="Open" width="12" height="12">';
        }
        
        // Show empty state if no meetings
        const meetingItems = list.querySelectorAll('.meeting-item');
        const emptyState = list.querySelector('.meeting-list-empty-state');
        if (meetingItems.length === 0 && emptyState) {
          emptyState.style.display = 'block';
        }
      }
      return;
    }
    
    console.log('Restoring state:', savedState);
    
    // Restore expanded categories
    if (savedState.expandedCategories && Array.isArray(savedState.expandedCategories)) {
      elements.categoryToggles.forEach(toggle => {
        const category = toggle.dataset.category;
        const list = document.querySelector(`.meeting-list[data-category="${category}"]`);
        const icon = toggle.querySelector('.category-icon');
        
        if (savedState.expandedCategories.includes(category)) {
          toggle.classList.add('active');
          if (list) list.style.display = 'flex';
          if (icon) {
            icon.innerHTML = '<img src="../icons/category-open-icon.png?v=' + Date.now() + '" alt="Open" width="12" height="12">';
          }
        } else {
          toggle.classList.remove('active');
          if (list) list.style.display = 'none';
          if (icon) {
            icon.innerHTML = '<img src="../icons/category-closed-icon.png?v=' + Date.now() + '" alt="Closed" width="12" height="12">';
          }
        }
      });
    }
    
    // Restore filters
    if (savedState.currentAgendaFilter) {
      state.currentAgendaFilter = savedState.currentAgendaFilter;
      // Update filter button states
      elements.agendaFilters.forEach(f => {
        f.classList.remove('active');
        if (f.dataset.filter === savedState.currentAgendaFilter) {
          f.classList.add('active');
        }
      });
    }
    if (savedState.currentActionFilter) {
      state.currentActionFilter = savedState.currentActionFilter;
      // Update filter button states
      if (elements.actionsFilters && elements.actionsFilters.length > 0) {
        elements.actionsFilters.forEach(f => {
          f.classList.remove('active');
          if (f.dataset.filter === savedState.currentActionFilter) {
            f.classList.add('active');
          }
        });
      }
    }
    
    // Restore action input values
    if (savedState.actionInputValues) {
      state.actionInputValues = savedState.actionInputValues;
    }
    
    // Restore selected meeting and view (after meetings are loaded)
    if (savedState.selectedMeetingId) {
      // Wait a bit for meetings to render, then select
      setTimeout(async () => {
        // Import dynamically to avoid circular dependency
        const { selectMeeting } = await import('./meeting-view.js');
        await selectMeeting(savedState.selectedMeetingId);
        
        // Restore view after selecting meeting
        if (savedState.currentView) {
          state.currentView = savedState.currentView;
          const { switchView } = await import('./meeting-view.js');
          await switchView(savedState.currentView);
        }
      }, 100);
    } else {
      // No meeting selected, but restore view if it was set
      if (savedState.currentView && savedState.currentView !== 'agenda') {
        state.currentView = savedState.currentView;
        const { switchView } = await import('./meeting-view.js');
        switchView(savedState.currentView);
      }
    }
  } catch (error) {
    console.error('Error restoring state:', error);
  }
}
