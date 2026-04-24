/**
 * Settings view module - lazy loaded when user clicks Settings.
 * Contains all settings-related logic including license, export/import.
 */
import * as licenseManager from './license.js';
import { getConfig, getEnv, setEnv } from '../config.js';
import {
  getAllCustomMeetingTypes,
  createCustomMeetingType,
  deleteCustomMeetingType,
  getMeetingTypeOrder,
  setMeetingTypeOrder,
  getCustomTypeKey,
} from './custom-meeting-types.js';

// Environment selector (#settings-env-field) is hidden by default; popup.js / sidepanel.js reveal it
// after five quick taps on the Settings title (developer-only local testing).

const BUILT_IN_TYPES = [
  { key: '1:1s',       name: '1:1s',       color: '#2b7fff' },
  { key: 'interviews', name: 'Interviews', color: '#0d9488' },
  { key: 'recurring',  name: 'Recurring',  color: '#8e51ff' },
  { key: 'adhoc',      name: 'Ad Hoc',     color: '#fe9a00' },
];

let _hydrated = false;
let _meetingTypesCallbacks = {};
let _chipDrag = null;

export async function displaySettingsView(elements, callbacks = {}) {
  _meetingTypesCallbacks = callbacks;

  if (!_hydrated) {
    await hydrateSettingsView(elements, callbacks);
    _hydrated = true;
  }

  if (elements.settingsView) {
    elements.settingsView.style.display = 'flex';
  }
  const mainContent = document.querySelector('.main-content');
  if (mainContent) mainContent.style.display = 'none';

  if (elements.settingsButton) {
    elements.settingsButton.classList.add('selected');
    const unselectedIcon = elements.settingsButton.querySelector('.settings-icon-unselected');
    const selectedIcon = elements.settingsButton.querySelector('.settings-icon-selected');
    if (unselectedIcon) unselectedIcon.style.display = 'none';
    if (selectedIcon) selectedIcon.style.display = 'block';
  }

  await refreshMeetingTypesList();
  await updateLicenseStatusDisplay(elements);
}

export async function hydrateSettingsView(elements, callbacks = {}) {
  if (elements.settingsLicenseEmailInput) {
    const license = await licenseManager.loadLicense();
    if (license && license.email) {
      elements.settingsLicenseEmailInput.value = license.email;
    }
    elements.settingsLicenseEmailInput.addEventListener('blur', () => handleLicenseKeyChange(elements));
    elements.settingsLicenseEmailInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleLicenseKeyChange(elements);
    });
  }

  if (elements.settingsProductKeyInput) {
    const license = await licenseManager.loadLicense();
    if (license && license.license_key) {
      elements.settingsProductKeyInput.value = license.license_key;
    }
    elements.settingsProductKeyInput.addEventListener('blur', () => handleLicenseKeyChange(elements));
    elements.settingsProductKeyInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleLicenseKeyChange(elements);
    });
  }

  if (elements.settingsNameInput) {
    const saved = await chrome.storage.local.get('user_name');
    if (saved.user_name) elements.settingsNameInput.value = saved.user_name;
    elements.settingsNameInput.addEventListener('blur', () => {
      chrome.storage.local.set({ user_name: elements.settingsNameInput.value });
    });
  }

  const envSelect = document.getElementById('settings-env-select');
  if (envSelect) {
    envSelect.value = await getEnv();
    envSelect.addEventListener('change', async () => {
      await setEnv(envSelect.value);
    });
  }

  const privacyLink = document.getElementById('settings-privacy-link');
  if (privacyLink) {
    privacyLink.addEventListener('click', async () => {
      const cfg = await getConfig();
      const base = (cfg.WEBSITE_URL || 'https://www.popouts.app').replace(/\/$/, '');
      chrome.tabs.create({ url: `${base}/privacy` });
    });
  }

  if (elements.settingsExportDataButton && callbacks.onExport) {
    elements.settingsExportDataButton.addEventListener('click', callbacks.onExport);
  }
  if (elements.settingsImportDataButton && callbacks.onImportClick) {
    elements.settingsImportDataButton.addEventListener('click', callbacks.onImportClick);
  }
  if (elements.settingsImportFileInput && callbacks.onImportFileSelected) {
    elements.settingsImportFileInput.addEventListener('change', callbacks.onImportFileSelected);
  }

  setupLicenseRequestHandlers();
  hydrateAddMeetingTypeRow();
}

// ─────────────────────────────────────────────────────────────────
// Meeting Types section
// ─────────────────────────────────────────────────────────────────

function hydrateAddMeetingTypeRow() {
  const input = document.getElementById('settings-add-type-input');
  const btn   = document.getElementById('settings-add-type-btn');
  if (!input || !btn) return;

  const submit = () => handleAddMeetingType(input);

  btn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    if (e.key === 'Escape') { input.value = ''; hideAddTypeError(); }
  });
}

async function refreshMeetingTypesList() {
  const list = document.getElementById('settings-meeting-types-list');
  if (!list) return;

  const [typeOrder, customTypes] = await Promise.all([
    getMeetingTypeOrder(),
    getAllCustomMeetingTypes(),
  ]);

  const builtInByKey = {};
  BUILT_IN_TYPES.forEach(t => { builtInByKey[t.key] = t; });
  const customByKey = {};
  customTypes.forEach(ct => { customByKey[getCustomTypeKey(ct.id)] = ct; });

  list.innerHTML = '';

  for (const typeKey of typeOrder) {
    const builtIn = builtInByKey[typeKey];
    if (builtIn) {
      list.appendChild(buildTypeChip(builtIn.name, builtIn.color, null, builtIn.key));
    } else if (customByKey[typeKey]) {
      const ct = customByKey[typeKey];
      list.appendChild(buildTypeChip(ct.name, ct.color, ct.id, typeKey));
    }
  }

  hydrateChipDragReorder();
}

function buildTypeChip(name, color, customId, typeKey) {
  const chip = document.createElement('span');
  chip.className = 'settings-type-chip' + (customId != null ? ' settings-type-chip--custom' : '');
  chip.dataset.typeKey = typeKey;

  const handle = document.createElement('span');
  handle.className = 'settings-type-drag-handle';
  handle.title = 'Drag to reorder';
  handle.innerHTML = `<svg width="8" height="10" viewBox="0 0 8 10" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="2.5" cy="2" r="1" fill="currentColor"/><circle cx="5.5" cy="2" r="1" fill="currentColor"/><circle cx="2.5" cy="5" r="1" fill="currentColor"/><circle cx="5.5" cy="5" r="1" fill="currentColor"/><circle cx="2.5" cy="8" r="1" fill="currentColor"/><circle cx="5.5" cy="8" r="1" fill="currentColor"/></svg>`;

  const dot = document.createElement('span');
  dot.className = 'settings-type-dot';
  dot.style.backgroundColor = color;

  const label = document.createElement('span');
  label.className = 'settings-type-name';
  label.textContent = name;

  chip.appendChild(handle);
  chip.appendChild(dot);
  chip.appendChild(label);

  if (customId != null) {
    const del = document.createElement('button');
    del.className = 'settings-type-delete';
    del.type = 'button';
    del.title = `Remove ${name}`;
    del.setAttribute('aria-label', `Remove ${name}`);
    del.innerHTML = `<svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`;
    del.addEventListener('click', () => handleDeleteMeetingType(customId, name));
    chip.appendChild(del);
  }

  return chip;
}

// ─────────────────────────────────────────────────────────────────
// Chip drag-to-reorder
// ─────────────────────────────────────────────────────────────────

function hydrateChipDragReorder() {
  const list = document.getElementById('settings-meeting-types-list');
  if (!list) return;

  // Remove any previous listener by cloning; simpler than tracking refs.
  const freshList = list.cloneNode(true);
  list.parentNode.replaceChild(freshList, list);

  // Re-attach static listeners (delete buttons were lost in the clone)
  freshList.querySelectorAll('.settings-type-chip').forEach(chip => {
    const delBtn = chip.querySelector('.settings-type-delete');
    if (delBtn) {
      const customId = Number(chip.dataset.typeKey?.replace('custom_', ''));
      const name = chip.querySelector('.settings-type-name')?.textContent || '';
      delBtn.addEventListener('click', () => handleDeleteMeetingType(customId, name));
    }
  });

  freshList.addEventListener('mousedown', (e) => {
    const handle = e.target.closest('.settings-type-drag-handle');
    if (!handle || e.button !== 0) return;
    const chip = handle.closest('.settings-type-chip');
    if (!chip) return;

    e.preventDefault();
    const rect = chip.getBoundingClientRect();

    const ghost = chip.cloneNode(true);
    Object.assign(ghost.style, {
      position: 'fixed',
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      margin: '0',
      zIndex: '99999',
      pointerEvents: 'none',
      opacity: '0.85',
      boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
      transition: 'none',
    });
    document.body.appendChild(ghost);
    chip.classList.add('settings-type-chip--dragging');

    _chipDrag = {
      chip,
      ghost,
      typeKey: chip.dataset.typeKey,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      active: false,
      indicator: null,
    };

    document.addEventListener('mousemove', _onChipDragMove);
    document.addEventListener('mouseup', _onChipDragUp);
  });
}

function _onChipDragMove(e) {
  if (!_chipDrag) return;
  const dx = e.clientX - _chipDrag.startX;
  const dy = e.clientY - _chipDrag.startY;
  if (!_chipDrag.active && Math.sqrt(dx * dx + dy * dy) < 4) return;
  _chipDrag.active = true;

  _chipDrag.ghost.style.left = `${e.clientX - _chipDrag.offsetX}px`;
  _chipDrag.ghost.style.top  = `${e.clientY - _chipDrag.offsetY}px`;

  // Detect which chip is under the cursor
  _chipDrag.ghost.style.display = 'none';
  const elUnder = document.elementFromPoint(e.clientX, e.clientY);
  _chipDrag.ghost.style.display = '';

  document.querySelectorAll('.settings-type-drop-indicator').forEach(el => el.remove());
  _chipDrag.indicator = null;

  const chipUnder = elUnder?.closest('.settings-type-chip');
  if (chipUnder && chipUnder !== _chipDrag.chip) {
    const rect = chipUnder.getBoundingClientRect();
    const insertBefore = e.clientX < rect.left + rect.width / 2;
    const ind = document.createElement('span');
    ind.className = 'settings-type-drop-indicator';
    chipUnder.insertAdjacentElement(insertBefore ? 'beforebegin' : 'afterend', ind);
    _chipDrag.indicator = { chipUnder, insertBefore };
  }
}

async function _onChipDragUp() {
  if (!_chipDrag) return;
  document.removeEventListener('mousemove', _onChipDragMove);
  document.removeEventListener('mouseup', _onChipDragUp);

  const { chip, ghost, typeKey, active, indicator } = _chipDrag;
  _chipDrag = null;

  ghost.remove();
  chip.classList.remove('settings-type-chip--dragging');
  document.querySelectorAll('.settings-type-drop-indicator').forEach(el => el.remove());

  if (!active || !indicator) return;

  const { chipUnder, insertBefore } = indicator;
  const targetTypeKey = chipUnder.dataset.typeKey;
  if (!targetTypeKey || targetTypeKey === typeKey) return;

  // Read DOM order and compute the new sequence
  const list = document.getElementById('settings-meeting-types-list');
  if (!list) return;
  let currentOrder = [...list.querySelectorAll('.settings-type-chip[data-type-key]')]
    .map(c => c.dataset.typeKey);

  const fromIdx = currentOrder.indexOf(typeKey);
  if (fromIdx >= 0) currentOrder.splice(fromIdx, 1);

  const toIdx = currentOrder.indexOf(targetTypeKey);
  if (toIdx < 0) return;
  currentOrder.splice(insertBefore ? toIdx : toIdx + 1, 0, typeKey);

  await setMeetingTypeOrder(currentOrder);
  await refreshMeetingTypesList();
  _meetingTypesCallbacks.onMeetingTypesChanged?.();
}

async function handleAddMeetingType(input) {
  const name = input.value.trim();
  if (!name) { input.focus(); return; }

  const existing = await getAllCustomMeetingTypes();
  const allNames = [
    ...BUILT_IN_TYPES.map(t => t.name.toLowerCase()),
    ...existing.map(t => t.name.toLowerCase()),
  ];
  if (allNames.includes(name.toLowerCase())) {
    showAddTypeError('A meeting type with that name already exists.');
    input.focus();
    return;
  }

  hideAddTypeError();
  input.value = '';
  await createCustomMeetingType(name);
  await refreshMeetingTypesList();
  _meetingTypesCallbacks.onMeetingTypesChanged?.();
}

async function handleDeleteMeetingType(id, name) {
  if (!confirm(`Remove "${name}"? Meetings in this category will be moved to Ad Hoc.`)) return;
  await deleteCustomMeetingType(id);
  await refreshMeetingTypesList();
  _meetingTypesCallbacks.onMeetingTypesChanged?.();
}

function showAddTypeError(msg) {
  const el = document.getElementById('settings-add-type-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

function hideAddTypeError() {
  const el = document.getElementById('settings-add-type-error');
  if (el) el.style.display = 'none';
}

async function handleLicenseKeyChange(elements) {
  const licenseKey = elements.settingsProductKeyInput?.value?.trim();
  const email = elements.settingsLicenseEmailInput?.value?.trim();

  if (!licenseKey) {
    await licenseManager.clearLicense();
    await updateLicenseStatusDisplay(elements);
    return;
  }

  if (!email) {
    showLicenseError(elements, 'Please enter the email address used when the license was issued.');
    return;
  }

  const input = elements.settingsProductKeyInput;
  const originalBorder = input.style.borderColor;
  input.style.borderColor = '#f59e0b';

  const result = await licenseManager.activateLicense(email, licenseKey);

  if (result.success) {
    await updateLicenseStatusDisplay(elements);
    input.style.borderColor = '#008236';
    setTimeout(() => { input.style.borderColor = originalBorder; }, 2000);
  } else {
    input.style.borderColor = '#c10007';
    setTimeout(() => { input.style.borderColor = originalBorder; }, 3000);
    showLicenseError(elements, result.error);
  }
}

function showLicenseError(elements, message) {
  const existing = document.getElementById('license-error-message');
  if (existing) existing.remove();

  const errorDiv = document.createElement('div');
  errorDiv.id = 'license-error-message';
  errorDiv.className = 'license-error-message';
  errorDiv.textContent = message;

  const licenseField = elements.settingsProductKeyInput?.parentElement;
  if (licenseField) {
    licenseField.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }
}

export async function updateLicenseStatusDisplay(elements) {
  try {
    elements.licenseStatusActive = document.getElementById('license-status-active');
    elements.licenseStatusExpired = document.getElementById('license-status-expired');
    elements.licenseExpiryText = document.getElementById('license-expiry-text');
    elements.licenseExpiredText = document.getElementById('license-expired-text');
    elements.freeTrialStatusActive = document.getElementById('free-trial-status-active');
    elements.freeTrialStatusExpired = document.getElementById('free-trial-status-expired');
    elements.freeTrialActiveText = document.getElementById('free-trial-active-text');
    elements.freeTrialExpiredText = document.getElementById('free-trial-expired-text');

    if (!elements.licenseStatusActive || !elements.licenseStatusExpired) return;

    const status = await licenseManager.getLicenseStatus();

    elements.licenseStatusActive.style.display = 'none';
    elements.licenseStatusExpired.style.display = 'none';
    if (elements.freeTrialStatusActive) elements.freeTrialStatusActive.style.display = 'none';
    if (elements.freeTrialStatusExpired) elements.freeTrialStatusExpired.style.display = 'none';

    if (status.status === 'active') {
      if (elements.licenseExpiryText) elements.licenseExpiryText.textContent = status.message;
      elements.licenseStatusActive.style.display = 'block';
    } else if (status.status === 'expired') {
      if (elements.licenseExpiredText) elements.licenseExpiredText.textContent = status.message;
      elements.licenseStatusExpired.style.display = 'block';
    } else if (status.status === 'free_trial') {
      if (elements.freeTrialStatusActive && elements.freeTrialActiveText) {
        elements.freeTrialActiveText.textContent = status.message;
        elements.freeTrialStatusActive.style.display = 'block';
      }
    } else if (status.status === 'none') {
      if (elements.freeTrialStatusExpired && elements.freeTrialExpiredText) {
        const installDate = await licenseManager.getInstallDate();
        const trialEndDate = new Date(installDate);
        trialEndDate.setDate(trialEndDate.getDate() + 7);
        const now = new Date();
        const daysExpired = Math.max(0, Math.floor((now - trialEndDate) / (1000 * 60 * 60 * 24)));
        const formattedDate = trialEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        elements.freeTrialExpiredText.textContent = trialEndDate < now
          ? `Expired on ${formattedDate} (${daysExpired} days ago). Enter a license key to continue.`
          : 'Free trial expired. Enter a license key to continue.';
        elements.freeTrialStatusExpired.style.display = 'block';
      }
    }
  } catch (err) {
    console.error('[Settings] Error updating license status display:', err);
  }
}

function setupLicenseRequestHandlers() {
  const showForm = (contentEl, formEl) => {
    if (contentEl) contentEl.style.display = 'none';
    if (formEl) formEl.style.display = 'block';
  };
  const hideForm = (contentEl, formEl) => {
    if (contentEl) contentEl.style.display = 'flex';
    if (formEl) formEl.style.display = 'none';
  };

  const licenseCta = document.getElementById('license-request-cta');
  const licenseForm = document.getElementById('license-request-form');
  const licenseContent = document.getElementById('license-status-expired')?.querySelector('.license-status-content');
  if (licenseCta && licenseForm && licenseContent) {
    licenseCta.addEventListener('click', () => {
      const expiredText = document.getElementById('license-expired-text')?.textContent || '';
      const formDesc = document.getElementById('license-request-form-desc');
      if (formDesc) formDesc.textContent = `${expiredText} Enter your email below and we'll get in touch with a new license key.`;
      showForm(licenseContent, licenseForm);
    });
    document.getElementById('license-request-cancel')?.addEventListener('click', () => hideForm(licenseContent, licenseForm));
    document.getElementById('license-request-submit')?.addEventListener('click', () => handleLicenseRequestSubmit('license-request-email', document.getElementById('license-request-submit'), licenseContent, licenseForm));
  }

  const freeTrialCta = document.querySelector('.license-request-cta-free-trial');
  const freeTrialForm = document.getElementById('free-trial-request-form');
  const freeTrialContent = document.getElementById('free-trial-status-expired')?.querySelector('.license-status-content');
  if (freeTrialCta && freeTrialForm && freeTrialContent) {
    freeTrialCta.addEventListener('click', () => {
      const expiredText = document.getElementById('free-trial-expired-text')?.textContent || '';
      const formDesc = document.getElementById('free-trial-request-form-desc');
      if (formDesc) formDesc.textContent = `${expiredText} Enter your email below and we'll get in touch with a new license key.`;
      showForm(freeTrialContent, freeTrialForm);
    });
    document.getElementById('free-trial-request-cancel')?.addEventListener('click', () => hideForm(freeTrialContent, freeTrialForm));
    document.getElementById('free-trial-request-submit')?.addEventListener('click', () => handleLicenseRequestSubmit('free-trial-request-email', document.getElementById('free-trial-request-submit'), freeTrialContent, freeTrialForm));
  }
}

async function handleLicenseRequestSubmit(emailInputId, submitBtn, contentEl, formEl) {
  const input = document.getElementById(emailInputId);
  if (!input || !input.value.trim()) return;

  const email = input.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert('Please enter a valid email address.');
    return;
  }

  if (submitBtn) submitBtn.disabled = true;

  try {
    const cfg = await getConfig();
    const baseUrl = cfg.WEBSITE_URL || 'https://www.popouts.app';
    const resp = await fetch(`${baseUrl}/api/request-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to send request');
    }

    if (contentEl) contentEl.style.display = 'flex';
    if (formEl) {
      formEl.innerHTML = '<p class="license-request-success">Request sent! We\'ll get in touch with a new license key.</p>';
      formEl.style.display = 'block';
    }
    input.value = '';
  } catch (err) {
    alert(err.message || 'Something went wrong. Please try again.');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

