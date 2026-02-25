// Sidebar/category management module

import { state } from './state.js';
import { formatDate, updateCounts } from './utils.js';
import { getAllMeetingSeries, deleteMeetingSeries, createMeetingSeries, getMeetingStats } from '../meetings.js';
import { actionExtractionService } from './action-extraction.js';

// Initialize sidebar module
export function initSidebar(elements, callbacks) {
  // Store callbacks for external functions
  const { selectMeeting, updateCounts, saveState, loadMeetings } = callbacks;
  
  // Store selectMeeting callback globally for meeting item clicks
  window.selectMeetingCallback = selectMeeting;
  
  // Setup category toggle event listeners
  function setupCategoryToggles() {
    elements.categoryToggles.forEach(toggle => {
      toggle.addEventListener('click', async () => {
        const category = toggle.dataset.category;
        const list = document.querySelector(`.meeting-list[data-category="${category}"]`);
        const icon = toggle.querySelector('.category-icon');
        const isExpanded = toggle.classList.contains('active');
        
        if (isExpanded) {
          // Collapse
          list.style.display = 'none';
          toggle.classList.remove('active');
          if (icon) {
            icon.innerHTML = '<img src="../icons/category-closed-icon.png?v=' + Date.now() + '" alt="Closed" width="12" height="12">';
          }
        } else {
          // Expand
          list.style.display = 'flex';
          toggle.classList.add('active');
          if (icon) {
            icon.innerHTML = '<img src="../icons/category-open-icon.png?v=' + Date.now() + '" alt="Open" width="12" height="12">';
          }
          
          // Check if we should show empty state
          const meetingItems = list.querySelectorAll('.meeting-item');
          const emptyState = list.querySelector('.meeting-list-empty-state');
          if (meetingItems.length === 0 && emptyState) {
            emptyState.style.display = 'block';
            // Focus the input in empty state
            const emptyInput = emptyState.querySelector('.add-meeting-input');
            if (emptyInput) {
              setTimeout(() => emptyInput.focus(), 100);
            }
          } else if (meetingItems.length > 0 && emptyState) {
            emptyState.style.display = 'none';
          }
        }
        
        // Save state after toggling category
        await saveState(elements);
      });
    });
  }
  
  // Setup add meeting button handlers
  function setupAddMeetingButtons() {
    elements.addButtons.forEach((button) => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const category = button.dataset.category;
        showAddMeetingInput(category);
      });
    });
  }
  
  // Setup add meeting input handlers (event delegation)
  function setupAddMeetingInputHandlers() {
    // Auto-resize function for textarea
    function autoResizeTextarea(textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 48; // max-height from CSS
      textarea.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    }
    
    // Setup auto-resize on input for all add-meeting inputs
    document.addEventListener('input', (e) => {
      if (e.target.classList.contains('add-meeting-input')) {
        autoResizeTextarea(e.target);
      }
    });
    
    // Enter/Escape key handlers
    document.addEventListener('keydown', (e) => {
      if (e.target.classList.contains('add-meeting-input')) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const category = e.target.dataset.category;
          const name = e.target.value.trim();
        if (name) {
          handleAddMeetingInline(category, name, callbacks);
          // Reset height after submission
          e.target.style.height = 'auto';
        }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          const category = e.target.dataset.category;
          hideAddMeetingInput(category);
        }
      }
    });
    
    // Blur handler
    document.addEventListener('blur', (e) => {
      if (e.target.classList.contains('add-meeting-input')) {
        setTimeout(() => {
          const category = e.target.dataset.category;
          const container = document.querySelector(`.add-meeting-input-container[data-category="${category}"]:not(.meeting-list-empty-state .add-meeting-input-container)`);
          if (container && !container.matches(':hover') && document.activeElement !== e.target) {
            hideAddMeetingInput(category);
          }
        }, 100);
      }
    }, true);
    
    // Cancel button handlers
    document.addEventListener('click', (e) => {
      if (e.target.closest('.add-meeting-cancel')) {
        e.preventDefault();
        e.stopPropagation();
        const button = e.target.closest('.add-meeting-cancel');
        const category = button.dataset.category;
        hideAddMeetingInput(category);
      }
    });
  }
  
  // Initialize all sidebar event listeners
  setupCategoryToggles();
  setupAddMeetingButtons();
  setupAddMeetingInputHandlers();
}

// Load and display meetings
export async function loadMeetings(elements) {
  try {
    const allMeetings = await getAllMeetingSeries();
    
    // Group by type and sort by creation time (newest first)
    const meetingsByType = {
      '1:1s': [],
      'recurring': [],
      'adhoc': []
    };
    
    allMeetings.forEach(meeting => {
      if (meetingsByType[meeting.type]) {
        meetingsByType[meeting.type].push(meeting);
      }
    });
    
    // Sort each category by creation time (newest first)
    Object.keys(meetingsByType).forEach(type => {
      meetingsByType[type].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA; // Descending order (newest first)
      });
    });
    
    
    
    // Update counts
    const count1 = meetingsByType['1:1s'].length;
    const count2 = meetingsByType['recurring'].length;
    const count3 = meetingsByType['adhoc'].length;
    
    const countEl1 = document.querySelector('[data-category="1:1s"] .category-count');
    const countEl2 = document.querySelector('[data-category="recurring"] .category-count');
    const countEl3 = document.querySelector('[data-category="adhoc"] .category-count');
    
    if (countEl1) {
      countEl1.textContent = count1;
      countEl1.title = count1 === 1 ? '1 meeting' : `${count1} meetings`;
    }
    if (countEl2) {
      countEl2.textContent = count2;
      countEl2.title = count2 === 1 ? '1 meeting' : `${count2} meetings`;
    }
    if (countEl3) {
      countEl3.textContent = count3;
      countEl3.title = count3 === 1 ? '1 meeting' : `${count3} meetings`;
    }
    
    // Render meetings for each category
    for (const [type, meetingList] of Object.entries(meetingsByType)) {
      
      await renderMeetingList(type, meetingList, elements);
    }
    
    // Update category icons based on active state
    elements.categoryToggles.forEach(toggle => {
      const icon = toggle.querySelector('.category-icon');
      if (icon) {
        if (toggle.classList.contains('active')) {
          icon.innerHTML = '<img src="../icons/category-open-icon.png?v=1" alt="Open" width="12" height="12">';
        } else {
          icon.innerHTML = '<img src="../icons/category-closed-icon.png?v=1" alt="Closed" width="12" height="12">';
        }
      }
    });
    
    
  } catch (error) {
    console.error('Error loading meetings:', error);
  }
}

// Render meeting list for a category
async function renderMeetingList(type, meetingList, elements) {
  const listContainer = document.querySelector(`.meeting-list[data-category="${type}"]`);
  
  // Preserve the inline input container
  const inputContainer = listContainer.querySelector('.add-meeting-input-container:not(.meeting-list-empty-state .add-meeting-input-container)');
  const wasInputVisible = inputContainer && inputContainer.style.display !== 'none';
  
  // Get empty state
  const emptyState = listContainer.querySelector('.meeting-list-empty-state');
  
  // Clear only meeting items, keep the input container and empty state
  const existingItems = listContainer.querySelectorAll('.meeting-item');
  existingItems.forEach(item => item.remove());
  
  // Re-insert input container at the beginning if it exists
  if (inputContainer) {
    listContainer.insertBefore(inputContainer, listContainer.firstChild);
    if (!wasInputVisible) {
      inputContainer.style.display = 'none';
    }
  }
  
  // Show/hide empty state based on whether there are meetings
  if (meetingList.length === 0) {
    // Show empty state if category is expanded
    const categoryToggle = document.querySelector(`.category-toggle[data-category="${type}"]`);
    const meetingListEl = document.querySelector(`.meeting-list[data-category="${type}"]`);
    const isExpanded = categoryToggle && categoryToggle.classList.contains('active');
    const isVisible = meetingListEl && meetingListEl.style.display !== 'none';
    
    if (isExpanded || isVisible) {
      if (emptyState) {
        emptyState.style.display = 'block';
        // Focus the input in empty state
        const emptyInput = emptyState.querySelector('.add-meeting-input');
        if (emptyInput) {
          setTimeout(() => emptyInput.focus(), 100);
        }
      }
    } else {
      // Hide empty state if category is collapsed
      if (emptyState) {
        emptyState.style.display = 'none';
      }
    }
  } else {
    // Hide empty state
    if (emptyState) {
      emptyState.style.display = 'none';
    }
  }
  
  // Add meeting items
  for (const meeting of meetingList) {
    const stats = await getMeetingStats(meeting.id);
    const item = createMeetingItem(meeting, stats, elements);
    listContainer.appendChild(item);
  }
}

// Create meeting item element
function createMeetingItem(meeting, stats, elements) {
  const item = document.createElement('div');
  item.className = 'meeting-item';
  item.dataset.meetingId = meeting.id;
  
  const content = document.createElement('div');
  content.className = 'meeting-item-content';
  
  const name = document.createElement('div');
  name.className = 'meeting-item-name';
  name.textContent = meeting.name;
  
  const meta = document.createElement('div');
  meta.className = 'meeting-item-meta';
  
  // Date with clock icon - use lastDate if available, otherwise use createdAt
  const dateToShow = stats.lastDate || (meeting.createdAt ? new Date(meeting.createdAt) : null);
  if (dateToShow) {
    const dateContainer = document.createElement('div');
    dateContainer.className = 'meeting-item-date-container';
    
    const clockIcon = document.createElement('div');
    clockIcon.className = 'meeting-item-clock-icon';
    
    const date = document.createElement('span');
    date.className = 'meeting-item-date';
    date.textContent = formatDate(dateToShow);
    
    dateContainer.appendChild(clockIcon);
    dateContainer.appendChild(date);
    meta.appendChild(dateContainer);
  }
  
  // Open agenda badge
  if (stats.openAgendaCount > 0) {
    const badge = document.createElement('div');
    badge.className = 'meeting-item-badge';
    badge.title = stats.openAgendaCount === 1 ? '1 open agenda item' : `${stats.openAgendaCount} open agenda items`;
    const badgeText = document.createElement('span');
    badgeText.textContent = `${stats.openAgendaCount} open`;
    badge.appendChild(badgeText);
    meta.appendChild(badge);
  }
  
  // Notes count
  if (stats.noteCount > 0) {
    const notes = document.createElement('div');
    notes.className = 'meeting-item-notes';
    const notesText = document.createElement('span');
    notesText.textContent = `${stats.noteCount} notes`;
    notes.appendChild(notesText);
    meta.appendChild(notes);
  }
  
  // Extraction status indicator (will be updated by extraction service)
  // This will be populated when extraction status is checked
  
  content.appendChild(name);
  content.appendChild(meta);
  item.appendChild(content);
  
  // Load and display extraction status
  actionExtractionService.loadExtractionStatusIndicator(meeting.id, meta);
  
  // Delete button (shown on hover)
  const deleteButton = document.createElement('button');
  deleteButton.className = 'meeting-item-delete';
  deleteButton.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `;
  deleteButton.addEventListener('click', async (e) => {
    e.stopPropagation(); // Prevent selecting the meeting
    if (confirm(`Are you sure you want to delete "${meeting.name}"?`)) {
      await deleteMeetingSeries(meeting.id);
      await loadMeetings(elements);
      await updateCounts(elements);
      // Clear selection if deleted meeting was selected
      if (state.currentMeetingId === meeting.id) {
        state.currentMeetingId = null;
        if (elements.emptyState) elements.emptyState.style.display = 'flex';
        if (elements.meetingDetail) elements.meetingDetail.style.display = 'none';
      }
    }
  });
  item.appendChild(deleteButton);
  
  // Store callback for selectMeeting (will be set by initSidebar)
  item.addEventListener('click', () => {
    // This will be handled by the callback passed to initSidebar
    if (window.selectMeetingCallback) {
      window.selectMeetingCallback(meeting.id);
    }
  });
  
  return item;
}

// Update meeting badge for a specific meeting
export async function updateMeetingBadge(meetingId) {
  const meetingItem = document.querySelector(`.meeting-item[data-meeting-id="${meetingId}"]`);
  if (!meetingItem) return;
  
  const stats = await getMeetingStats(meetingId);
  const meta = meetingItem.querySelector('.meeting-item-meta');
  if (!meta) return;
  
  // Remove existing badge
  const existingBadge = meta.querySelector('.meeting-item-badge');
  if (existingBadge) {
    existingBadge.remove();
  }
  
  // Add new badge if there are open agenda items
  if (stats.openAgendaCount > 0) {
    const badge = document.createElement('div');
    badge.className = 'meeting-item-badge';
    badge.title = stats.openAgendaCount === 1 ? '1 open agenda item' : `${stats.openAgendaCount} open agenda items`;
    const badgeText = document.createElement('span');
    badgeText.textContent = `${stats.openAgendaCount} open`;
    badge.appendChild(badgeText);
    
    // Insert badge after date container (if exists) or at the beginning
    const dateContainer = meta.querySelector('.meeting-item-date-container');
    if (dateContainer) {
      dateContainer.insertAdjacentElement('afterend', badge);
    } else {
      meta.insertBefore(badge, meta.firstChild);
    }
  }
}

// Show inline add meeting input
export function showAddMeetingInput(category) {
  const container = document.querySelector(`.add-meeting-input-container[data-category="${category}"]:not(.meeting-list-empty-state .add-meeting-input-container)`);
  const input = document.querySelector(`.add-meeting-input[data-category="${category}"]`);
  const emptyState = document.querySelector(`.meeting-list-empty-state[data-category="${category}"]`);
  
  // Hide empty state when showing regular input
  if (emptyState) {
    emptyState.style.display = 'none';
  }
  
  if (container && input) {
    // Expand the category if collapsed
    const categoryToggle = document.querySelector(`.category-toggle[data-category="${category}"]`);
    const meetingList = document.querySelector(`.meeting-list[data-category="${category}"]`);
    const icon = categoryToggle ? categoryToggle.querySelector('.category-icon') : null;
    
    if (categoryToggle && meetingList) {
      meetingList.style.display = 'flex';
      categoryToggle.classList.add('active');
      if (icon) {
        icon.innerHTML = '<img src="../icons/category-open-icon.png?v=' + Date.now() + '" alt="Open" width="12" height="12">';
      }
    }
    
    container.style.display = 'flex';
    input.value = '';
    input.focus();
  }
}

// Hide inline add meeting input
export function hideAddMeetingInput(category) {
  const container = document.querySelector(`.add-meeting-input-container[data-category="${category}"]:not(.meeting-list-empty-state .add-meeting-input-container)`);
  const input = document.querySelector(`.add-meeting-input[data-category="${category}"]`);
  const emptyState = document.querySelector(`.meeting-list-empty-state[data-category="${category}"]`);
  const meetingList = document.querySelector(`.meeting-list[data-category="${category}"]`);
  
  if (container) {
    container.style.display = 'none';
  }
  if (input && !input.closest('.meeting-list-empty-state')) {
    input.value = '';
  }
  
  // Show empty state if no meetings exist
  if (emptyState && meetingList) {
    const meetingItems = meetingList.querySelectorAll('.meeting-item');
    const categoryToggle = document.querySelector(`.category-toggle[data-category="${category}"]`);
    if (meetingItems.length === 0 && categoryToggle && categoryToggle.classList.contains('active')) {
      emptyState.style.display = 'block';
      // Clear empty state input
      const emptyInput = emptyState.querySelector('.add-meeting-input');
      if (emptyInput) {
        emptyInput.value = '';
      }
    }
  }
}

// Handle adding meeting via inline input
async function handleAddMeetingInline(category, name, callbacks) {
  if (!name.trim()) {
    return;
  }
  
  try {
    const id = await createMeetingSeries(name.trim(), category);
    
    // Hide both regular input and empty state input
    const regularContainer = document.querySelector(`.add-meeting-input-container[data-category="${category}"]:not(.meeting-list-empty-state .add-meeting-input-container)`);
    const emptyState = document.querySelector(`.meeting-list-empty-state[data-category="${category}"]`);
    
    if (regularContainer) {
      regularContainer.style.display = 'none';
    }
    if (emptyState) {
      emptyState.style.display = 'none';
    }
    
    // Clear inputs
    const inputs = document.querySelectorAll(`.add-meeting-input[data-category="${category}"]`);
    inputs.forEach(input => input.value = '');
    
    // Reload meetings and select the new one
    await callbacks.loadMeetings();
    await callbacks.selectMeeting(id);
    await callbacks.updateCounts();
  } catch (error) {
    console.error('Error adding meeting:', error);
  }
}
