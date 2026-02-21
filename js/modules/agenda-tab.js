// Agenda tab module
import { getAgendaItems, toggleAgendaItem } from '../agenda.js';
import { state } from './state.js';

// Placeholder for elements object, will be passed from main orchestrator
let elements = {};
// Placeholder for updateCounts callback
let updateCountsCallback = null;

export function setAgendaDependencies(els, updateCountsCb) {
  elements = els;
  updateCountsCallback = updateCountsCb;
}

// Load agenda items for the current meeting
export async function loadAgenda() {
  if (!state.currentMeetingId) return;
  
  const items = await getAgendaItems(state.currentMeetingId, state.currentAgendaFilter);
  elements.agendaList.innerHTML = '';
  
  // Update filter counts
  const allItems = await getAgendaItems(state.currentMeetingId, 'all');
  const openItems = allItems.filter(item => item.status === 'open');
  const closedItems = allItems.filter(item => item.status === 'closed');
  
  document.querySelector('[data-filter="all"] .filter-count').textContent = allItems.length;
  document.querySelector('[data-filter="open"] .filter-count').textContent = openItems.length;
  document.querySelector('[data-filter="closed"] .filter-count').textContent = closedItems.length;
  elements.agendaCount.textContent = allItems.length;
  
  // Show/hide input container based on filter
  const agendaInputContainer = document.querySelector('.agenda-input-container');
  if (agendaInputContainer) {
    if (state.currentAgendaFilter === 'closed') {
      agendaInputContainer.style.display = 'none';
    } else {
      agendaInputContainer.style.display = 'flex';
    }
  }
  
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
  } else {
    if (agendaEmptyState) agendaEmptyState.style.display = 'none';
    items.forEach(item => {
      const element = createAgendaItemElement(item);
      elements.agendaList.appendChild(element);
    });
  }
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
