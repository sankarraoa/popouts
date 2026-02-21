// Consolidated actions module
import { getAllActionItems, createActionItem } from '../actions.js';
import { getAllMeetingSeries } from '../meetings.js';
import { state } from './state.js';
import { createActionItemElement } from './actions-tab.js';
import { db } from '../db.js';

// Placeholder for elements object, will be passed from main orchestrator
let elements = {};
// Placeholder for callbacks
let updateCountsCallback = null;

export function setConsolidatedActionsDependencies(els, updateCountsCb) {
  elements = els;
  updateCountsCallback = updateCountsCb;
}

// Load consolidated action items (all meetings)
export async function loadConsolidatedActions() {
  console.log('=== loadConsolidatedActions called ===');
  const filter = state.currentActionFilter || 'all';
  let items = await getAllActionItems(filter);
  
  // Apply search filter if query exists
  if (state.currentActionSearchQuery && state.currentActionSearchQuery.trim()) {
    const searchLower = state.currentActionSearchQuery.toLowerCase().trim();
    items = items.filter(item => 
      item.text.toLowerCase().includes(searchLower)
    );
  }
  
  console.log('Items found:', items.length, 'Filter:', filter, 'Search:', state.currentActionSearchQuery);
  
  if (!elements.consolidatedActionsList) {
    console.error('consolidatedActionsList not found!');
    return;
  }
  
  elements.consolidatedActionsList.innerHTML = '';
  
  // Update filter counts
  const allItems = await getAllActionItems('all');
  const openItems = allItems.filter(item => item.status === 'open');
  const closedItems = allItems.filter(item => item.status === 'closed');
  
  console.log('All items:', allItems.length, 'Open:', openItems.length, 'Closed:', closedItems.length);
  
  if (elements.consolidatedActionsFilters && elements.consolidatedActionsFilters.length > 0) {
    elements.consolidatedActionsFilters.forEach(btn => {
      const filterType = btn.dataset.filter;
      const countEl = btn.querySelector('.filter-count');
      if (countEl) {
        if (filterType === 'all') {
          countEl.textContent = allItems.length;
        } else if (filterType === 'open') {
          countEl.textContent = openItems.length;
        } else if (filterType === 'closed') {
          countEl.textContent = closedItems.length;
        }
      }
    });
  }
  
  // Show/hide empty state
  const emptyState = document.getElementById('consolidated-actions-empty-state');
  console.log('Empty state element:', emptyState);
  
  const emptyTitle = emptyState ? emptyState.querySelector('.actions-empty-title') : null;
  const emptyDescription = emptyState ? emptyState.querySelector('.actions-empty-description') : null;
  
  if (items.length === 0) {
    console.log('No items, showing empty state');
    if (emptyState) {
      emptyState.style.display = 'flex';
      console.log('Empty state display set to flex');
    }
    
    if (emptyTitle) {
      if (filter === 'closed') {
        emptyTitle.textContent = 'No closed action items yet';
      } else if (filter === 'open') {
        emptyTitle.textContent = 'No open action items yet';
      } else {
        emptyTitle.textContent = 'No action items yet';
      }
    }
    
    if (emptyDescription) {
      if (filter === 'closed') {
        emptyDescription.style.display = 'none';
      } else {
        emptyDescription.style.display = 'block';
      }
    }
  } else {
    console.log('Items found, hiding empty state and rendering items');
    if (emptyState) emptyState.style.display = 'none';
    for (const item of items) {
      const element = await createActionItemElement(item, false); // false = consolidated view
      elements.consolidatedActionsList.appendChild(element);
    }
  }
}

// Show add action section
export async function showAddActionSection() {
  if (!elements.addActionContainer) return;
  
  elements.addActionContainer.style.display = 'block';
  if (elements.addActionInput) {
    elements.addActionInput.focus();
  }
  
  // Populate dropdown with meetings
  await populateAddActionDropdown();
  
  // Scroll to top of actions list
  if (elements.consolidatedActionsList) {
    elements.consolidatedActionsList.scrollTop = 0;
  }
}

// Hide add action section
export function hideAddActionSection() {
  if (!elements.addActionContainer) return;
  
  elements.addActionContainer.style.display = 'none';
  if (elements.addActionInput) {
    elements.addActionInput.value = '';
  }
  if (elements.addActionDropdown) {
    elements.addActionDropdown.style.display = 'none';
  }
  // Reset to "General" when hiding
  state.selectedMeetingForAction = null;
  if (elements.addActionDropdownSelected) {
    elements.addActionDropdownSelected.textContent = 'Select meeting';
  }
}

// Populate dropdown with all meetings
async function populateAddActionDropdown() {
  if (!elements.addActionDropdown || !elements.addActionDropdownSelected) return;
  
  const meetings = await getAllMeetingSeries();
  elements.addActionDropdown.innerHTML = '';
  
  // Add "General" option first (not tied to any meeting)
  const generalItem = document.createElement('div');
  generalItem.className = 'add-action-dropdown-item';
  generalItem.dataset.meetingId = 'general';
  
  const generalName = document.createElement('span');
  generalName.textContent = 'General';
  generalItem.appendChild(generalName);
  
  // Default to "General" if no meeting selected
  if (!state.selectedMeetingForAction) {
    generalItem.classList.add('selected');
    state.selectedMeetingForAction = 'general';
    elements.addActionDropdownSelected.textContent = 'General';
  } else if (state.selectedMeetingForAction === 'general') {
    generalItem.classList.add('selected');
  }
  
  generalItem.addEventListener('click', () => {
    state.selectedMeetingForAction = 'general';
    elements.addActionDropdownSelected.textContent = 'General';
    elements.addActionDropdown.querySelectorAll('.add-action-dropdown-item').forEach(el => {
      el.classList.remove('selected');
    });
    generalItem.classList.add('selected');
    elements.addActionDropdown.style.display = 'none';
  });
  
  elements.addActionDropdown.appendChild(generalItem);
  
  // Add all meetings
  meetings.forEach((meeting) => {
    const item = document.createElement('div');
    item.className = 'add-action-dropdown-item';
    item.dataset.meetingId = meeting.id;
    
    if (state.selectedMeetingForAction === meeting.id) {
      item.classList.add('selected');
    }
    
    const name = document.createElement('span');
    name.textContent = meeting.name;
    item.appendChild(name);
    
    item.addEventListener('click', () => {
      state.selectedMeetingForAction = meeting.id;
      // Update selected text in button
      elements.addActionDropdownSelected.textContent = meeting.name;
      // Update visual selection
      elements.addActionDropdown.querySelectorAll('.add-action-dropdown-item').forEach(el => {
        el.classList.remove('selected');
      });
      item.classList.add('selected');
      // Close dropdown
      elements.addActionDropdown.style.display = 'none';
    });
    
    elements.addActionDropdown.appendChild(item);
  });
  
  // Update selected text if a meeting is already selected
  if (state.selectedMeetingForAction && state.selectedMeetingForAction !== 'general') {
    const selectedMeeting = meetings.find(m => m.id === state.selectedMeetingForAction);
    if (selectedMeeting) {
      elements.addActionDropdownSelected.textContent = selectedMeeting.name;
    }
  }
}

// Handle adding action
export async function handleAddAction() {
  if (!elements.addActionInput) return;
  
  const text = elements.addActionInput.value.trim();
  if (!text) return;
  
  if (!state.selectedMeetingForAction) {
    alert('Please select a meeting to tag this action with.');
    return;
  }
  
  try {
    // Handle "General" option (no meeting association)
    if (state.selectedMeetingForAction === 'general') {
      // Create action item without seriesId and instanceId
      await db.actionItems.add({
        seriesId: null,
        instanceId: null,
        text: text,
        status: 'open',
        createdAt: new Date(),
        closedAt: null
      });
    } else {
      // Get or create today's instance for the selected meeting
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Find or create instance
      const instances = await db.meetingInstances
        .where('seriesId')
        .equals(state.selectedMeetingForAction)
        .toArray();
      
      let instance = instances.find(inst => {
        const instDate = new Date(inst.date);
        instDate.setHours(0, 0, 0, 0);
        return instDate.getTime() === today.getTime();
      });
      
      if (!instance) {
        // Create new instance for today
        instance = {
          seriesId: state.selectedMeetingForAction,
          date: today,
          createdAt: new Date()
        };
        instance.id = await db.meetingInstances.add(instance);
      }
      
      // Create action item
      await createActionItem(state.selectedMeetingForAction, instance.id, text);
    }
    
    // Clear input and hide section
    hideAddActionSection();
    
    // Reload actions
    await loadConsolidatedActions();
    if (updateCountsCallback) {
      await updateCountsCallback();
    }
  } catch (error) {
    console.error('Error adding action:', error);
    alert('Failed to add action item. Please try again.');
  }
}
