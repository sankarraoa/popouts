/**
 * Settings view module - lazy loaded when user clicks Settings.
 * Contains all settings-related logic including license, export/import.
 */
import * as licenseManager from './license.js';
import { getConfig, getEnv, setEnv } from '../config.js';

let _hydrated = false;

export async function displaySettingsView(elements, callbacks = {}) {
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

