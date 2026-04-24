// Sidebar/category management module

import { state } from './state.js';
import { formatDate } from './utils.js';
import { getAllMeetingSeries, deleteMeetingSeries, createMeetingSeries, getMeetingStats, updateMeetingSeries, coerceMeetingId } from '../meetings.js';
import { actionExtractionService } from './action-extraction.js';
import {
  getAllCustomMeetingTypes,
  deleteCustomMeetingType,
  getCustomTypeKey,
  getMeetingTypeOrder,
} from './custom-meeting-types.js';

// Module-level references set by initSidebar
let _elements = null;
let _callbacks = null;

// ─── Mouse-based drag state ───
let _drag = null; // { meeting, item, ghost, startX, startY, offsetX, offsetY, active }

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Initialize sidebar module
export function initSidebar(elements, callbacks) {
  _elements = elements;
  _callbacks = callbacks;

  // Store selectMeeting callback globally for meeting item clicks
  window.selectMeetingCallback = callbacks.selectMeeting;

  setupEventDelegation(elements, callbacks);
  setupAddMeetingInputHandlers(callbacks);
  setupMouseDragListeners();
}

// ─── Event delegation for category toggles, add-meeting buttons, delete-type buttons ───

function setupEventDelegation(elements, callbacks) {
  const categoriesEl = document.querySelector('.meeting-categories');
  if (!categoriesEl) return;

  categoriesEl.addEventListener('click', async (e) => {
    // Category toggle
    const toggle = e.target.closest('.category-toggle');
    if (toggle && !e.target.closest('.delete-type-button')) {
      await handleCategoryToggle(toggle, elements, callbacks);
      return;
    }

    // Add meeting button
    const addBtn = e.target.closest('.add-button');
    if (addBtn) {
      e.preventDefault();
      e.stopPropagation();
      showAddMeetingInput(addBtn.dataset.category);
      return;
    }

    // Delete custom type button
    const deleteTypeBtn = e.target.closest('.delete-type-button');
    if (deleteTypeBtn) {
      e.preventDefault();
      e.stopPropagation();
      const typeId = Number(deleteTypeBtn.dataset.typeId);
      const typeName = deleteTypeBtn.dataset.typeName || 'this meeting type';
      await handleDeleteCustomType(typeId, typeName, callbacks);
      return;
    }
  });
}

async function handleCategoryToggle(toggle, elements, callbacks) {
  const category = toggle.dataset.category;
  const list = document.querySelector(`.meeting-list[data-category="${category}"]`);
  const icon = toggle.querySelector('.category-icon');
  const isExpanded = toggle.classList.contains('active');

  if (isExpanded) {
    list.style.display = 'none';
    toggle.classList.remove('active');
    if (icon) icon.innerHTML = closedIconHtml();
  } else {
    list.style.display = 'flex';
    toggle.classList.add('active');
    if (icon) icon.innerHTML = openIconHtml();

    const meetingItems = list.querySelectorAll('.meeting-item');
    const emptyState = list.querySelector('.meeting-list-empty-state');
    if (meetingItems.length === 0 && emptyState) {
      emptyState.style.display = 'block';
      const emptyInput = emptyState.querySelector('.add-meeting-input');
      if (emptyInput) setTimeout(() => emptyInput.focus(), 100);
    } else if (meetingItems.length > 0 && emptyState) {
      emptyState.style.display = 'none';
    }
  }

  await callbacks.saveState(elements);
}

async function handleDeleteCustomType(typeId, typeName, callbacks) {
  const confirmed = await showDeleteCustomTypeConfirm(typeName);
  if (!confirmed) return;
  await deleteCustomMeetingType(typeId);
  await callbacks.loadMeetings();
  await callbacks.updateCounts();
}

// ─── Add meeting input handlers (event delegation on document) ───

function setupAddMeetingInputHandlers(callbacks) {
  function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 48) + 'px';
  }

  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('add-meeting-input')) {
      autoResizeTextarea(e.target);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('add-meeting-input')) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const category = e.target.dataset.category;
        const name = e.target.value.trim();
        if (name) {
          handleAddMeetingInline(category, name, callbacks);
          e.target.style.height = 'auto';
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideAddMeetingInput(e.target.dataset.category);
      }
    }
  });

  document.addEventListener('blur', (e) => {
    // Only act on blur from the *inline* input, not the empty-state one.
    // Hiding the empty-state element causes its input to blur too, and we must
    // not close the inline container as a result of that.
    if (e.target.classList.contains('add-meeting-input') &&
        !e.target.closest('.meeting-list-empty-state')) {
      setTimeout(() => {
        const category = e.target.dataset.category;
        const container = document.querySelector(
          `.add-meeting-input-container[data-category="${category}"]:not(.meeting-list-empty-state .add-meeting-input-container)`
        );
        if (container && !container.matches(':hover') && document.activeElement !== e.target) {
          hideAddMeetingInput(category);
        }
      }, 100);
    }
  }, true);

  document.addEventListener('click', (e) => {
    if (e.target.closest('.add-meeting-cancel')) {
      e.preventDefault();
      e.stopPropagation();
      const category = e.target.closest('.add-meeting-cancel').dataset.category;
      hideAddMeetingInput(category);
    }
  });
}

// ─── Mouse-based drag (replaces HTML5 drag API for extension popup/panel reliability) ───

function clearAllDragHighlights() {
  document.querySelectorAll('.category-section.drag-over, .category-section.drag-over--forbidden')
    .forEach(el => el.classList.remove('drag-over', 'drag-over--forbidden'));
}

function setupMouseDragListeners() {
  document.addEventListener('mousemove', onDragMouseMove);
  document.addEventListener('mouseup', onDragMouseUp);
}

function startDrag(meeting, item, clientX, clientY) {
  const rect = item.getBoundingClientRect();

  const ghost = item.cloneNode(true);
  Object.assign(ghost.style, {
    position: 'fixed',
    top: rect.top + 'px',
    left: rect.left + 'px',
    width: rect.width + 'px',
    margin: '0',
    zIndex: '99999',
    pointerEvents: 'none',
    borderRadius: '8px',
    background: '#fff',
    boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
    opacity: '0.92',
    transition: 'none',
  });
  document.body.appendChild(ghost);

  _drag = {
    meeting,
    item,
    ghost,
    startX: clientX,
    startY: clientY,
    offsetX: clientX - rect.left,
    offsetY: clientY - rect.top,
    active: false,
  };
}

function onDragMouseMove(e) {
  if (!_drag) return;

  const dx = e.clientX - _drag.startX;
  const dy = e.clientY - _drag.startY;

  // Activate after 4px movement to distinguish from a click
  if (!_drag.active && Math.sqrt(dx * dx + dy * dy) < 4) return;

  if (!_drag.active) {
    _drag.active = true;
    _drag.item.classList.add('dragging');
    document.body.classList.add('is-dragging-meeting');
    document.onselectstart = () => false;
  }

  // Move ghost with cursor
  _drag.ghost.style.left = (e.clientX - _drag.offsetX) + 'px';
  _drag.ghost.style.top  = (e.clientY - _drag.offsetY) + 'px';

  // Highlight the category section under the cursor
  _drag.ghost.style.display = 'none';
  const elUnder = document.elementFromPoint(e.clientX, e.clientY);
  _drag.ghost.style.display = '';

  const section = elUnder ? elUnder.closest('.category-section') : null;

  document.querySelectorAll('.category-section.drag-over, .category-section.drag-over--forbidden')
    .forEach(s => { if (s !== section) s.classList.remove('drag-over', 'drag-over--forbidden'); });

  if (section) {
    const t = section.dataset.category;
    if (t === 'interviews') {
      section.classList.remove('drag-over');
      section.classList.add('drag-over--forbidden');
    } else {
      section.classList.remove('drag-over--forbidden');
      section.classList.add('drag-over');
    }
  }
}

async function onDragMouseUp(e) {
  if (!_drag) return;

  const { meeting, item, ghost, active } = _drag;
  _drag = null;

  ghost.remove();
  item.classList.remove('dragging');
  document.body.classList.remove('is-dragging-meeting');
  document.onselectstart = null;
  clearAllDragHighlights();

  if (!active) return; // Didn't move — treat as a click, let normal handler fire

  // Find drop target (hide ghost so elementFromPoint sees the page behind)
  const elUnder = document.elementFromPoint(e.clientX, e.clientY);
  const section = elUnder ? elUnder.closest('.category-section') : null;
  if (!section) return;

  const targetType = section.dataset.category;
  if (!targetType || targetType === 'interviews' || targetType === meeting.type) return;

  await updateMeetingSeries(coerceMeetingId(meeting.id), { type: targetType });

  // Expand target category if it was collapsed
  const targetList   = section.querySelector('.meeting-list');
  const targetToggle = section.querySelector('.category-toggle');
  if (targetToggle && !targetToggle.classList.contains('active')) {
    if (targetList) targetList.style.display = 'flex';
    targetToggle.classList.add('active');
    const icon = targetToggle.querySelector('.category-icon');
    if (icon) icon.innerHTML = openIconHtml();
  }

  if (_elements) await loadMeetings(_elements);
  if (_callbacks) await _callbacks.updateCounts();
}

// ─── Icon HTML helpers ───

function openIconHtml() {
  return `<img src="../icons/category-open-icon.png?v=${Date.now()}" alt="Open" width="12" height="12">`;
}

function closedIconHtml() {
  return `<img src="../icons/category-closed-icon.png?v=${Date.now()}" alt="Closed" width="12" height="12">`;
}

// ─── Dynamic custom category injection ───

async function injectCustomCategories(customTypes) {
  const container = document.querySelector('.meeting-categories');
  if (!container) return;

  // Remove stale custom sections (will be re-injected in correct order)
  container.querySelectorAll('.category-section.custom-type').forEach(el => el.remove());

  // Insert before the add-category footer
  const footer = document.querySelector('.add-category-section');

  for (const ct of customTypes) {
    const typeKey = getCustomTypeKey(ct.id);
    const section = buildCategorySection(typeKey, ct.name, ct.color, ct.id);
    if (footer) {
      container.insertBefore(section, footer);
    } else {
      container.appendChild(section);
    }
  }
}

function buildCategorySection(typeKey, displayName, color, customTypeId) {
  const section = document.createElement('div');
  section.className = 'category-section' + (customTypeId != null ? ' custom-type' : '');
  section.dataset.category = typeKey;

  const deleteBtn = customTypeId != null
    ? `<button class="delete-type-button" data-type-id="${customTypeId}" data-type-name="${escapeHtml(displayName)}" title="Delete meeting type">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        </svg>
      </button>`
    : '';

  const placeholder = escapeHtml(`${displayName}…`);

  section.innerHTML = `
    <div class="category-header">
      <button class="category-toggle" data-category="${escapeHtml(typeKey)}">
        <span class="category-icon">${closedIconHtml()}</span>
        <span class="category-dot" style="background-color: ${escapeHtml(color)};"></span>
        <span class="category-name">${escapeHtml(displayName)}</span>
        <span class="category-count">0</span>
      </button>
      ${deleteBtn}
      <button class="add-button" data-category="${escapeHtml(typeKey)}">+ Add</button>
    </div>
    <div class="meeting-list" data-category="${escapeHtml(typeKey)}" style="display: none;">
      <div class="meeting-list-empty-state" data-category="${escapeHtml(typeKey)}" style="display: none;">
        <div class="add-meeting-input-container">
          <textarea class="add-meeting-input" placeholder="${placeholder}" data-category="${escapeHtml(typeKey)}" rows="1"></textarea>
          <div class="add-meeting-helper">
            <span class="add-meeting-helper-text">Enter to add · Esc to cancel</span>
            <button class="add-meeting-cancel" data-category="${escapeHtml(typeKey)}" title="Cancel">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="rgba(113, 113, 130, 0.4)" stroke-width="0.833333" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div class="add-meeting-input-container" data-category="${escapeHtml(typeKey)}" style="display: none;">
        <textarea class="add-meeting-input" placeholder="${placeholder}" data-category="${escapeHtml(typeKey)}" rows="1"></textarea>
        <div class="add-meeting-helper">
          <span class="add-meeting-helper-text">Enter to add · Esc to cancel</span>
          <button class="add-meeting-cancel" data-category="${escapeHtml(typeKey)}" title="Cancel">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="rgba(113, 113, 130, 0.4)" stroke-width="0.833333" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
  return section;
}

// ─── Delete custom type confirmation ───

function showDeleteCustomTypeConfirm(typeName) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('delete-meeting-modal');
    const messageEl = document.getElementById('delete-modal-message');
    const cancelBtn = document.getElementById('delete-modal-cancel');
    const confirmBtn = document.getElementById('delete-modal-confirm');

    if (!overlay || !messageEl || !cancelBtn || !confirmBtn) {
      resolve(confirm(`Delete "${typeName}"? Meetings in this type will be moved to Ad Hoc.`));
      return;
    }

    messageEl.textContent = `Delete "${typeName}"? Meetings in this type will be moved to Ad Hoc.`;
    overlay.classList.add('show');

    const cleanup = (result) => {
      overlay.classList.remove('show');
      cancelBtn.removeEventListener('click', onCancel);
      confirmBtn.removeEventListener('click', onConfirm);
      overlay.removeEventListener('click', onOverlay);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };

    const onCancel = () => cleanup(false);
    const onConfirm = () => cleanup(true);
    const onOverlay = (e) => { if (e.target === overlay) cleanup(false); };
    const onKey = (e) => { if (e.key === 'Escape') cleanup(false); };

    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onConfirm);
    overlay.addEventListener('click', onOverlay);
    document.addEventListener('keydown', onKey);
  });
}

// ─── Load and display meetings ───

export async function loadMeetings(elements) {
  try {
    const allMeetings = await getAllMeetingSeries();

    // Load custom types independently so a DB upgrade hiccup doesn't block
    // the whole meeting list from rendering.
    let customTypes = [];
    try {
      customTypes = await getAllCustomMeetingTypes();
    } catch (e) {
      console.warn('Could not load custom meeting types:', e);
    }

    // Inject/refresh dynamic custom category sections
    await injectCustomCategories(customTypes);

    // Build the type bucket map
    const meetingsByType = {
      '1:1s': [],
      'interviews': [],
      'recurring': [],
      'adhoc': [],
    };
    customTypes.forEach(ct => {
      meetingsByType[getCustomTypeKey(ct.id)] = [];
    });

    allMeetings.forEach(meeting => {
      if (meetingsByType[meeting.type] !== undefined) {
        meetingsByType[meeting.type].push(meeting);
      }
    });

    // Sort each category newest first
    Object.keys(meetingsByType).forEach(type => {
      meetingsByType[type].sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tB - tA;
      });
    });

    // Update counts for all categories (built-in + custom)
    Object.entries(meetingsByType).forEach(([type, list]) => {
      const countEl = document.querySelector(`[data-category="${type}"] .category-count`);
      if (countEl) {
        countEl.textContent = list.length;
        countEl.title = list.length === 1 ? '1 meeting' : `${list.length} meetings`;
      }
    });

    // Render meetings for each category
    for (const [type, meetingList] of Object.entries(meetingsByType)) {
      await renderMeetingList(type, meetingList, elements);
    }

    // Apply persisted category order via CSS flex `order`
    try {
      const typeOrder = await getMeetingTypeOrder();
      typeOrder.forEach((typeKey, idx) => {
        const section = document.querySelector(`.category-section[data-category="${typeKey}"]`);
        if (section) section.style.order = String(idx);
      });
    } catch (e) {
      console.warn('Could not apply category order:', e);
    }

    // Update category icons based on active state
    document.querySelectorAll('.category-toggle').forEach(toggle => {
      const icon = toggle.querySelector('.category-icon');
      if (icon) {
        icon.innerHTML = toggle.classList.contains('active') ? openIconHtml() : closedIconHtml();
      }
    });

    // Re-apply selected state
    if (state.currentMeetingId != null) {
      const idStr = String(state.currentMeetingId);
      const selectedItem = document.querySelector(`.meeting-item[data-meeting-id="${idStr}"]`);
      if (selectedItem) selectedItem.classList.add('selected');
    }
  } catch (error) {
    console.error('Error loading meetings:', error);
  }
}

// ─── Render meeting list for a category ───

async function renderMeetingList(type, meetingList, elements) {
  const listContainer = document.querySelector(`.meeting-list[data-category="${type}"]`);
  if (!listContainer) return;

  // Preserve inline input container
  const inputContainer = listContainer.querySelector(
    '.add-meeting-input-container:not(.meeting-list-empty-state .add-meeting-input-container)'
  );
  const wasInputVisible = inputContainer && inputContainer.style.display !== 'none';
  const emptyState = listContainer.querySelector('.meeting-list-empty-state');

  // Remove only meeting items
  listContainer.querySelectorAll('.meeting-item').forEach(item => item.remove());

  // Re-insert input container at top
  if (inputContainer) {
    listContainer.insertBefore(inputContainer, listContainer.firstChild);
    if (!wasInputVisible) inputContainer.style.display = 'none';
  }

  // Show/hide empty state
  if (meetingList.length === 0) {
    const categoryToggle = document.querySelector(`.category-toggle[data-category="${type}"]`);
    const isExpanded = categoryToggle && categoryToggle.classList.contains('active');
    const isVisible = listContainer.style.display !== 'none';
    if ((isExpanded || isVisible) && emptyState) {
      emptyState.style.display = 'block';
      const emptyInput = emptyState.querySelector('.add-meeting-input');
      if (emptyInput) setTimeout(() => emptyInput.focus(), 100);
    } else if (emptyState) {
      emptyState.style.display = 'none';
    }
  } else if (emptyState) {
    emptyState.style.display = 'none';
  }

  // Pre-fetch stats for all meetings so we can sort by most-recent date
  const statsMap = new Map();
  await Promise.all(meetingList.map(async (m) => {
    statsMap.set(m.id, await getMeetingStats(m.id));
  }));

  // Sort newest-activity-first: lastDate (most recent instance) → createdAt fallback
  const sorted = [...meetingList].sort((a, b) => {
    const sA = statsMap.get(a.id);
    const sB = statsMap.get(b.id);
    const tA = sA?.lastDate ? new Date(sA.lastDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const tB = sB?.lastDate ? new Date(sB.lastDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return tB - tA;
  });

  for (const meeting of sorted) {
    const stats = statsMap.get(meeting.id);
    const item = createMeetingItem(meeting, stats, elements);
    listContainer.appendChild(item);
  }
}

// ─── Show delete meeting confirmation ───

export function showDeleteConfirm(meetingName) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('delete-meeting-modal');
    const messageEl = document.getElementById('delete-modal-message');
    const cancelBtn = document.getElementById('delete-modal-cancel');
    const confirmBtn = document.getElementById('delete-modal-confirm');

    if (!overlay || !messageEl || !cancelBtn || !confirmBtn) {
      resolve(confirm(`Are you sure you want to delete "${meetingName}"?`));
      return;
    }

    messageEl.textContent = `Are you sure you want to delete "${meetingName}"?`;
    overlay.classList.add('show');

    const cleanup = (result) => {
      overlay.classList.remove('show');
      cancelBtn.removeEventListener('click', onCancel);
      confirmBtn.removeEventListener('click', onConfirm);
      overlay.removeEventListener('click', onOverlayClick);
      document.removeEventListener('keydown', onKeyDown);
      resolve(result);
    };

    const onCancel = () => cleanup(false);
    const onConfirm = () => cleanup(true);
    const onOverlayClick = (e) => { if (e.target === overlay) cleanup(false); };
    const onKeyDown = (e) => { if (e.key === 'Escape') cleanup(false); };

    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onConfirm);
    overlay.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKeyDown);
  });
}

// ─── Create meeting item element ───

function createMeetingItem(meeting, stats, elements) {
  const item = document.createElement('div');
  item.className = 'meeting-item';
  item.dataset.meetingId = String(meeting.id);
  item.dataset.meetingType = meeting.type;

  if (state.currentMeetingId != null && String(state.currentMeetingId) === String(meeting.id)) {
    item.classList.add('selected');
  }

  const content = document.createElement('div');
  content.className = 'meeting-item-content';

  const name = document.createElement('div');
  name.className = 'meeting-item-name';
  name.textContent = meeting.name;

  const meta = document.createElement('div');
  meta.className = 'meeting-item-meta';

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

  if (stats.openAgendaCount > 0) {
    const badge = document.createElement('div');
    badge.className = 'meeting-item-badge';
    badge.title = stats.openAgendaCount === 1 ? '1 open agenda item' : `${stats.openAgendaCount} open agenda items`;
    const badgeText = document.createElement('span');
    badgeText.textContent = `${stats.openAgendaCount} open`;
    badge.appendChild(badgeText);
    meta.appendChild(badge);
  }

  if (stats.noteCount > 0) {
    const notes = document.createElement('div');
    notes.className = 'meeting-item-notes';
    const notesText = document.createElement('span');
    notesText.textContent = `${stats.noteCount} notes`;
    notes.appendChild(notesText);
    meta.appendChild(notes);
  }

  content.appendChild(name);
  content.appendChild(meta);
  item.appendChild(content);

  actionExtractionService.loadExtractionStatusIndicator(meeting.id, meta);

  item.addEventListener('click', () => {
    if (window.selectMeetingCallback) window.selectMeetingCallback(meeting.id);
  });

  // Drag handle — uses mouse events (not HTML5 drag API) for reliable behaviour in extension windows
  if (meeting.type !== 'interviews') {
    const dragHandle = document.createElement('div');
    dragHandle.className = 'meeting-item-drag-handle';
    dragHandle.setAttribute('aria-hidden', 'true');
    dragHandle.innerHTML = `
      <svg width="10" height="14" viewBox="0 0 10 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="3" cy="2.5"  r="1.2" fill="currentColor"/>
        <circle cx="7" cy="2.5"  r="1.2" fill="currentColor"/>
        <circle cx="3" cy="7"    r="1.2" fill="currentColor"/>
        <circle cx="7" cy="7"    r="1.2" fill="currentColor"/>
        <circle cx="3" cy="11.5" r="1.2" fill="currentColor"/>
        <circle cx="7" cy="11.5" r="1.2" fill="currentColor"/>
      </svg>
    `;

    dragHandle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();  // prevent text selection
      e.stopPropagation(); // prevent item click
      startDrag(meeting, item, e.clientX, e.clientY);
    });

    item.appendChild(dragHandle);
  }

  return item;
}

// ─── Update meeting badge ───

export async function updateMeetingBadge(meetingId) {
  const meetingItem = document.querySelector(`.meeting-item[data-meeting-id="${meetingId}"]`);
  if (!meetingItem) return;

  const stats = await getMeetingStats(meetingId);
  const meta = meetingItem.querySelector('.meeting-item-meta');
  if (!meta) return;

  const existingBadge = meta.querySelector('.meeting-item-badge');
  if (existingBadge) existingBadge.remove();

  if (stats.openAgendaCount > 0) {
    const badge = document.createElement('div');
    badge.className = 'meeting-item-badge';
    badge.title = stats.openAgendaCount === 1 ? '1 open agenda item' : `${stats.openAgendaCount} open agenda items`;
    const badgeText = document.createElement('span');
    badgeText.textContent = `${stats.openAgendaCount} open`;
    badge.appendChild(badgeText);
    const dateContainer = meta.querySelector('.meeting-item-date-container');
    if (dateContainer) {
      dateContainer.insertAdjacentElement('afterend', badge);
    } else {
      meta.insertBefore(badge, meta.firstChild);
    }
  }
}

// ─── Show/hide inline add meeting input ───

export function showAddMeetingInput(category) {
  const container = document.querySelector(
    `.add-meeting-input-container[data-category="${category}"]:not(.meeting-list-empty-state .add-meeting-input-container)`
  );
  const emptyState = document.querySelector(`.meeting-list-empty-state[data-category="${category}"]`);

  if (emptyState) emptyState.style.display = 'none';

  if (container) {
    const categoryToggle = document.querySelector(`.category-toggle[data-category="${category}"]`);
    const meetingList = document.querySelector(`.meeting-list[data-category="${category}"]`);
    const icon = categoryToggle ? categoryToggle.querySelector('.category-icon') : null;

    if (categoryToggle && meetingList) {
      meetingList.style.display = 'flex';
      categoryToggle.classList.add('active');
      if (icon) icon.innerHTML = openIconHtml();
    }

    container.style.display = 'flex';
    // Focus the input that is actually inside this container, not the first
    // DOM match (which would be the hidden empty-state textarea).
    const containerInput = container.querySelector('.add-meeting-input');
    if (containerInput) {
      containerInput.value = '';
      // Use setTimeout so the browser has painted the container as visible
      // before transferring focus to it.
      setTimeout(() => containerInput.focus(), 0);
    }
  }
}

export function hideAddMeetingInput(category) {
  const container = document.querySelector(
    `.add-meeting-input-container[data-category="${category}"]:not(.meeting-list-empty-state .add-meeting-input-container)`
  );
  const emptyState = document.querySelector(`.meeting-list-empty-state[data-category="${category}"]`);
  const meetingList = document.querySelector(`.meeting-list[data-category="${category}"]`);

  if (container) {
    container.style.display = 'none';
    const containerInput = container.querySelector('.add-meeting-input');
    if (containerInput) containerInput.value = '';
  }

  if (emptyState && meetingList) {
    const meetingItems = meetingList.querySelectorAll('.meeting-item');
    const categoryToggle = document.querySelector(`.category-toggle[data-category="${category}"]`);
    if (meetingItems.length === 0 && categoryToggle && categoryToggle.classList.contains('active')) {
      emptyState.style.display = 'block';
      const emptyInput = emptyState.querySelector('.add-meeting-input');
      if (emptyInput) {
        emptyInput.value = '';
        setTimeout(() => emptyInput.focus(), 0);
      }
    }
  }
}

// ─── Handle adding a meeting via inline input ───

async function handleAddMeetingInline(category, name, callbacks) {
  if (!name.trim()) return;
  try {
    const id = await createMeetingSeries(name.trim(), category);

    const regularContainer = document.querySelector(
      `.add-meeting-input-container[data-category="${category}"]:not(.meeting-list-empty-state .add-meeting-input-container)`
    );
    const emptyState = document.querySelector(`.meeting-list-empty-state[data-category="${category}"]`);
    if (regularContainer) regularContainer.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';

    document.querySelectorAll(`.add-meeting-input[data-category="${category}"]`).forEach(input => {
      input.value = '';
    });

    await callbacks.loadMeetings();
    await callbacks.selectMeeting(id);
    await callbacks.updateCounts();
  } catch (error) {
    console.error('Error adding meeting:', error);
  }
}
