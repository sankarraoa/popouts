// Agenda tab module
import { getAgendaItems, toggleAgendaItem } from '../agenda.js';
import { state } from './state.js';
import { updateMeetingBadge } from './sidebar.js';

// Placeholder for elements object, will be passed from main orchestrator
let elements = {};
// Placeholder for updateCounts callback
let updateCountsCallback = null;

// Pagination state
const INITIAL_SCROLLS = 2; // Initial number of scrolls worth of data
const SCROLLS_PER_PAGE = 2; // Additional scrolls per "Show More" click
const ESTIMATED_ITEMS_PER_SCROLL = 8; // Estimated items visible per scroll
let currentAgendaPage = 1;
let allAgendaItems = [];

export function setAgendaDependencies(els, updateCountsCb) {
  elements = els;
  updateCountsCallback = updateCountsCb;
}

// Load agenda items for the current meeting
export async function loadAgenda(resetPagination = true) {
  if (!state.currentMeetingId) return;
  
  // Reset pagination when filter changes
  if (resetPagination) {
    currentAgendaPage = 1;
  }
  
  const items = await getAgendaItems(state.currentMeetingId, state.currentAgendaFilter);
  allAgendaItems = items;
  elements.agendaList.innerHTML = '';
  
  // Update filter counts - scope to agenda view
  const allItems = await getAgendaItems(state.currentMeetingId, 'all');
  const openItems = allItems.filter(item => item.status === 'open');
  const closedItems = allItems.filter(item => item.status === 'closed');
  
  const agendaView = document.getElementById('agenda-view');
  if (agendaView) {
    const allFilter = agendaView.querySelector('[data-filter="all"] .filter-count');
    const openFilter = agendaView.querySelector('[data-filter="open"] .filter-count');
    const closedFilter = agendaView.querySelector('[data-filter="closed"] .filter-count');
    
    if (allFilter) allFilter.textContent = allItems.length;
    if (openFilter) openFilter.textContent = openItems.length;
    if (closedFilter) closedFilter.textContent = closedItems.length;
  }
  if (elements.agendaCount) {
    elements.agendaCount.textContent = allItems.length;
  }
  
  // Show/hide input container based on filter
  const agendaInputContainer = document.querySelector('.agenda-input-container');
  if (agendaInputContainer) {
    if (state.currentAgendaFilter === 'closed') {
      agendaInputContainer.style.display = 'none';
    } else {
      agendaInputContainer.style.display = 'flex';
      // Auto-focus agenda input when filter is 'all' or 'open'
      const agendaInput = document.getElementById('agenda-input');
      if (agendaInput && (state.currentAgendaFilter === 'all' || state.currentAgendaFilter === 'open')) {
        setTimeout(() => {
          agendaInput.focus();
        }, 100);
      }
    }
  }
  
  // Calculate pagination
  const totalItems = items.length;
  const itemsToShow = INITIAL_SCROLLS * ESTIMATED_ITEMS_PER_SCROLL + (currentAgendaPage - 1) * SCROLLS_PER_PAGE * ESTIMATED_ITEMS_PER_SCROLL;
  
  // Show/hide empty state and update message
  const agendaEmptyState = document.getElementById('agenda-empty-state');
  const agendaEmptyTitle = document.querySelector('.agenda-empty-title');
  const agendaEmptyDescription = document.querySelector('.agenda-empty-description');
  
  if (items.length === 0) {
    if (agendaEmptyState) agendaEmptyState.style.display = 'flex';
    
    // Update empty state message based on filter
    if (agendaEmptyTitle) {
      if (state.currentAgendaFilter === 'closed') {
        agendaEmptyTitle.textContent = 'No closed agenda items yet';
      } else if (state.currentAgendaFilter === 'open') {
        agendaEmptyTitle.textContent = 'No open agenda items yet';
      } else {
        agendaEmptyTitle.textContent = 'No agenda items yet';
      }
    }
    
    // Hide description for closed filter
    if (agendaEmptyDescription) {
      if (state.currentAgendaFilter === 'closed') {
        agendaEmptyDescription.style.display = 'none';
      } else {
        agendaEmptyDescription.style.display = 'block';
      }
    }
    
    // Hide Show More button when empty
    const showMoreContainer = elements.agendaList.querySelector('#agenda-show-more');
    if (showMoreContainer) {
      showMoreContainer.style.display = 'none';
    }
  } else {
    if (agendaEmptyState) agendaEmptyState.style.display = 'none';
    
    // Remove existing Show More button if present
    const existingShowMore = elements.agendaList.querySelector('#agenda-show-more');
    if (existingShowMore) {
      existingShowMore.remove();
    }
    
    // Render items with pagination
    const itemsToRender = items.slice(0, itemsToShow);
    itemsToRender.forEach(item => {
      const element = createAgendaItemElement(item);
      elements.agendaList.appendChild(element);
    });
    
    // Add Show More button if there are more items
    if (itemsToRender.length < totalItems) {
      let showMoreContainer = document.getElementById('agenda-show-more');
      if (!showMoreContainer) {
        showMoreContainer = document.createElement('div');
        showMoreContainer.id = 'agenda-show-more';
        showMoreContainer.className = 'agenda-show-more';
        const button = document.createElement('button');
        button.className = 'agenda-show-more-button';
        button.textContent = 'Show More';
        showMoreContainer.appendChild(button);
      }
      showMoreContainer.style.display = 'flex';
      elements.agendaList.appendChild(showMoreContainer);
    } else {
      const showMoreContainer = elements.agendaList.querySelector('#agenda-show-more');
      if (showMoreContainer) {
        showMoreContainer.style.display = 'none';
      }
    }
  }
}

// Handle "Show More" button click for agenda
export async function handleShowMoreAgenda() {
  currentAgendaPage++;
  await loadAgenda(false); // Don't reset pagination
}

// Create agenda item element
function createAgendaItemElement(item) {
  const div = document.createElement('div');
  div.className = `agenda-item ${item.status === 'closed' ? 'closed' : ''}`;
  div.dataset.itemId = item.id;
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'agenda-item-checkbox';
  checkbox.checked = item.status === 'closed';
  checkbox.addEventListener('change', async () => {
    await toggleAgendaItem(item.id);
    await loadAgenda();
    // Update meeting badge in sidebar
    if (state.currentMeetingId) {
      await updateMeetingBadge(state.currentMeetingId);
    }
    if (updateCountsCallback) {
      await updateCountsCallback();
    }
  });
  
  const text = document.createElement('div');
  text.className = 'agenda-item-text';
  text.textContent = item.text;
  
  div.appendChild(checkbox);
  div.appendChild(text);
  
  return div;
}
