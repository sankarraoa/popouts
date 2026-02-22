// Actions tab module (meeting-specific)
import { getActionItems, toggleActionItem } from '../actions.js';
import { state } from './state.js';

// Placeholder for elements object, will be passed from main orchestrator
let elements = {};
// Placeholder for callbacks
let updateCountsCallback = null;
let loadConsolidatedActionsCallback = null;

// Pagination state
const INITIAL_SCROLLS = 2; // Initial number of scrolls worth of data
const SCROLLS_PER_PAGE = 2; // Additional scrolls per "Show More" click
const ESTIMATED_ITEMS_PER_SCROLL = 8; // Estimated items visible per scroll
let currentActionsPage = 1;
let allActionItems = [];

export function setActionsDependencies(els, updateCountsCb, loadConsolidatedActionsCb) {
  elements = els;
  updateCountsCallback = updateCountsCb;
  loadConsolidatedActionsCallback = loadConsolidatedActionsCb;
}

// Load action items for a specific meeting
export async function loadActions(resetPagination = true) {
  if (!state.currentMeetingId) return;
  
  // Reset pagination when filter changes
  if (resetPagination) {
    currentActionsPage = 1;
  }
  
  const items = await getActionItems(state.currentMeetingId, state.currentActionFilter);
  allActionItems = items;
  elements.actionsList.innerHTML = '';
  
  // Update filter counts
  const allItems = await getActionItems(state.currentMeetingId, 'all');
  const openItems = allItems.filter(item => item.status === 'open');
  const closedItems = allItems.filter(item => item.status === 'closed');
  
  document.querySelectorAll('#actions-view [data-filter="all"] .filter-count').forEach(el => {
    el.textContent = allItems.length;
  });
  document.querySelectorAll('#actions-view [data-filter="open"] .filter-count').forEach(el => {
    el.textContent = openItems.length;
  });
  document.querySelectorAll('#actions-view [data-filter="closed"] .filter-count').forEach(el => {
    el.textContent = closedItems.length;
  });
  elements.actionsDetailCount.textContent = allItems.filter(item => item.status === 'open').length;
  
  // Show/hide input container based on filter (hide for closed, like agenda)
  const actionsInputContainer = document.querySelector('#actions-view .actions-input-container');
  if (actionsInputContainer) {
    if (state.currentActionFilter === 'closed') {
      actionsInputContainer.style.display = 'none';
    } else {
      actionsInputContainer.style.display = 'flex';
      // Auto-focus action input when filter is 'all' or 'open'
      if (elements.actionsInput && (state.currentActionFilter === 'all' || state.currentActionFilter === 'open')) {
        setTimeout(() => {
          elements.actionsInput.focus();
        }, 100);
      }
    }
  }
  
  // Restore action input value for this meeting
  if (elements.actionsInput) {
    elements.actionsInput.value = state.actionInputValues[state.currentMeetingId] || '';
  }
  
  // Calculate pagination
  const totalItems = items.length;
  const itemsToShow = INITIAL_SCROLLS * ESTIMATED_ITEMS_PER_SCROLL + (currentActionsPage - 1) * SCROLLS_PER_PAGE * ESTIMATED_ITEMS_PER_SCROLL;
  
  // Show/hide empty state and update message
  const actionsEmptyState = document.getElementById('actions-empty-state');
  const actionsEmptyTitle = actionsEmptyState ? actionsEmptyState.querySelector('.actions-empty-title') : null;
  const actionsEmptyDescription = actionsEmptyState ? actionsEmptyState.querySelector('.actions-empty-description') : null;
  
  if (items.length === 0) {
    if (actionsEmptyState) actionsEmptyState.style.display = 'flex';
    
    // Update empty state message based on filter
    if (actionsEmptyTitle) {
      if (state.currentActionFilter === 'closed') {
        actionsEmptyTitle.textContent = 'No closed action items yet';
      } else if (state.currentActionFilter === 'open') {
        actionsEmptyTitle.textContent = 'No open action items yet';
      } else {
        actionsEmptyTitle.textContent = 'No action items yet';
      }
    }
    
    // Hide description for closed filter
    if (actionsEmptyDescription) {
      if (state.currentActionFilter === 'closed') {
        actionsEmptyDescription.style.display = 'none';
      } else {
        actionsEmptyDescription.style.display = 'block';
      }
    }
    
    // Hide Show More button when empty
    const showMoreContainer = elements.actionsList.querySelector('#actions-show-more');
    if (showMoreContainer) {
      showMoreContainer.style.display = 'none';
    }
  } else {
    if (actionsEmptyState) actionsEmptyState.style.display = 'none';
    
    // Remove existing Show More button if present
    const existingShowMore = elements.actionsList.querySelector('#actions-show-more');
    if (existingShowMore) {
      existingShowMore.remove();
    }
    
    // Render items with pagination
    const itemsToRender = items.slice(0, itemsToShow);
    for (const item of itemsToRender) {
      const element = await createActionItemElement(item, true); // true = meeting-specific view
      elements.actionsList.appendChild(element);
    }
    
    // Add Show More button if there are more items
    if (itemsToRender.length < totalItems) {
      let showMoreContainer = document.getElementById('actions-show-more');
      if (!showMoreContainer) {
        showMoreContainer = document.createElement('div');
        showMoreContainer.id = 'actions-show-more';
        showMoreContainer.className = 'actions-show-more';
        const button = document.createElement('button');
        button.className = 'actions-show-more-button';
        button.textContent = 'Show More';
        showMoreContainer.appendChild(button);
      }
      showMoreContainer.style.display = 'flex';
      elements.actionsList.appendChild(showMoreContainer);
    } else {
      const showMoreContainer = elements.actionsList.querySelector('#actions-show-more');
      if (showMoreContainer) {
        showMoreContainer.style.display = 'none';
      }
    }
  }
}

// Handle "Show More" button click for actions
export async function handleShowMoreActions() {
  currentActionsPage++;
  await loadActions(false); // Don't reset pagination
}

// Create action item element
export async function createActionItemElement(item, isMeetingSpecific = false) {
  const div = document.createElement('div');
  div.className = `action-item ${item.status === 'closed' ? 'closed' : ''} ${isMeetingSpecific ? 'action-item-meeting-specific' : 'action-item-consolidated'}`;
  div.dataset.itemId = item.id;
  
  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'action-item-checkbox';
  checkbox.checked = item.status === 'closed';
  checkbox.addEventListener('change', async () => {
    await toggleActionItem(item.id);
    // Reload the appropriate view based on which is visible
    if (elements.consolidatedActionsView && elements.consolidatedActionsView.style.display !== 'none') {
      if (loadConsolidatedActionsCallback) {
        await loadConsolidatedActionsCallback();
      }
    } else if (state.currentMeetingId && elements.actionsView && elements.actionsView.classList.contains('active')) {
      await loadActions();
    }
    if (updateCountsCallback) {
      await updateCountsCallback();
    }
  });
  
  // Text
  const text = document.createElement('div');
  text.className = 'action-item-text';
  text.textContent = item.text;
  
  // Only add meta (meeting name, date, status badge) for consolidated view
  if (!isMeetingSpecific) {
    // Content container (for consolidated view)
    const contentContainer = document.createElement('div');
    contentContainer.className = 'action-item-content';
    
    // Checkbox container (for consolidated view)
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'action-item-checkbox-container';
    checkboxContainer.appendChild(checkbox);
    
    contentContainer.appendChild(text);
    
    // Meta (meeting name and date)
    const meta = document.createElement('div');
    meta.className = 'action-item-meta';
    
    // Get meeting name
    let meetingName = 'General';
    let instanceDate = null;
    
    if (item.seriesId) {
      const { getMeetingSeries } = await import('../meetings.js');
      const meeting = await getMeetingSeries(item.seriesId);
      meetingName = meeting ? meeting.name : 'Unknown Meeting';
      
      // Get instance date
      if (item.instanceId) {
        const { db } = await import('../db.js');
        const instance = await db.meetingInstances.get(item.instanceId);
        if (instance) {
          instanceDate = new Date(instance.date);
        }
      }
    }
    
    const meetingBadge = document.createElement('span');
    meetingBadge.className = 'action-item-meeting-badge';
    meetingBadge.textContent = meetingName;
    
    const dateText = document.createElement('span');
    dateText.className = 'action-item-date';
    if (instanceDate) {
      const month = instanceDate.toLocaleString('default', { month: 'short' });
      const day = instanceDate.getDate();
      dateText.textContent = `${month} ${day}`;
    }
    
    meta.appendChild(meetingBadge);
    meta.appendChild(dateText);
    
    contentContainer.appendChild(meta);
    
    // Status badge
    const statusBadge = document.createElement('div');
    statusBadge.className = `action-item-status-badge ${item.status === 'closed' ? 'closed' : 'open'}`;
    statusBadge.textContent = item.status === 'closed' ? 'Closed' : 'Open';
    
    div.appendChild(checkboxContainer);
    div.appendChild(contentContainer);
    div.appendChild(statusBadge);
  } else {
    // For meeting-specific view, append checkbox and text directly (like agenda items)
    div.appendChild(checkbox);
    div.appendChild(text);
  }
  
  return div;
}
