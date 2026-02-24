// License Management Module
// Handles license validation, activation, and status display

import { getConfig, onEnvChange } from '../config.js';

const LICENSE_STORAGE_KEY = 'user_license';
const INSTALLATION_ID_KEY = 'installation_id';
const INSTALL_DATE_KEY = 'install_date';
const FREE_TRIAL_DAYS = 30;

let _apiBaseUrl = null;
async function getApiBaseUrl() {
  if (!_apiBaseUrl) {
    const cfg = await getConfig();
    _apiBaseUrl = `${cfg.LICENSE_SERVICE_URL}/api/v1`;
  }
  return _apiBaseUrl;
}
onEnvChange(() => { _apiBaseUrl = null; });

// Generate or get installation ID (device fingerprint)
async function getInstallationId() {
  const stored = await chrome.storage.local.get(INSTALLATION_ID_KEY);
  if (stored[INSTALLATION_ID_KEY]) {
    return stored[INSTALLATION_ID_KEY];
  }
  
  // Generate installation ID based on browser/device characteristics
  const fingerprint = [
    navigator.userAgent,
    screen.width + 'x' + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    chrome.runtime.id
  ].join('|');
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const installationId = Math.abs(hash).toString(16).substring(0, 16).toUpperCase();
  await chrome.storage.local.set({ [INSTALLATION_ID_KEY]: installationId });
  
  return installationId;
}

// Get install date (for free trial tracking)
async function getInstallDate() {
  const stored = await chrome.storage.local.get(INSTALL_DATE_KEY);
  if (stored[INSTALL_DATE_KEY]) {
    const date = new Date(stored[INSTALL_DATE_KEY]);
    console.log(`[License] Install date loaded: ${date.toISOString()}`);
    return date;
  }
  
  // First install - store current date
  const installDate = new Date();
  await chrome.storage.local.set({ [INSTALL_DATE_KEY]: installDate.toISOString() });
  console.log(`[License] First install detected - Storing install date: ${installDate.toISOString()}`);
  return installDate;
}

// Load license from storage
async function loadLicense() {
  const result = await chrome.storage.local.get(LICENSE_STORAGE_KEY);
  return result[LICENSE_STORAGE_KEY] || null;
}

// Save license to storage
async function saveLicense(licenseData) {
  await chrome.storage.local.set({ [LICENSE_STORAGE_KEY]: licenseData });
}

// Clear license
async function clearLicense() {
  await chrome.storage.local.remove(LICENSE_STORAGE_KEY);
}

// Check if free trial is active
async function isFreeTrialActive() {
  const installDate = await getInstallDate();
  const trialEndDate = new Date(installDate);
  trialEndDate.setDate(trialEndDate.getDate() + FREE_TRIAL_DAYS);
  const isActive = new Date() < trialEndDate;
  
  console.log(`[License] Free trial check - Install date: ${installDate.toISOString()}, Trial ends: ${trialEndDate.toISOString()}, Active: ${isActive}`);
  
  return isActive;
}

// Get free trial days remaining
async function getFreeTrialDaysRemaining() {
  const installDate = await getInstallDate();
  const trialEndDate = new Date(installDate);
  trialEndDate.setDate(trialEndDate.getDate() + FREE_TRIAL_DAYS);
  const now = new Date();
  const diff = trialEndDate - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// Calculate days between dates
function daysBetween(date1, date2) {
  const diff = date2 - date1;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// Format date for display
function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Activate license
async function activateLicense(email, licenseKey) {
  try {
    const installationId = await getInstallationId();
    const apiBase = await getApiBaseUrl();
    
    const response = await fetch(`${apiBase}/license/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        installation_id: installationId,
        license_key: licenseKey
      })
    });
    
    if (!response.ok) {
      let errorMessage = 'License activation failed';
      try {
        const error = await response.json();
        errorMessage = error.detail || error.message || errorMessage;
      } catch (e) {
        // If response isn't JSON, check status
        if (response.status === 0 || response.status >= 500) {
          errorMessage = 'Cannot connect to license server. Please check if the server is running.';
        } else if (response.status === 404) {
          errorMessage = 'License server endpoint not found. Please check the server configuration.';
        } else if (response.status === 400) {
          errorMessage = 'Invalid license key or email. Please check your license key.';
        }
      }
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    
    if (result.valid) {
      await saveLicense({
        email: email,
        license_key: licenseKey,
        expiry: result.expiry,
        activated_at: new Date().toISOString()
      });
      return { success: true, expiry: result.expiry };
    } else {
      return { 
        success: false, 
        error: result.message || result.reason || 'License activation failed' 
      };
    }
  } catch (error) {
    console.error('Error activating license:', error);
    if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
      return { 
        success: false, 
        error: 'Cannot connect to license server. Please check your network connection.' 
      };
    }
    return { success: false, error: error.message || 'License activation failed' };
  }
}

// Validate installation with server
async function validateInstallation() {
  try {
    const license = await loadLicense();
    if (!license) {
      return { valid: false, reason: 'no_license' };
    }
    
    const installationId = await getInstallationId();
    const apiBase = await getApiBaseUrl();
    
    const response = await fetch(
      `${apiBase}/license/validate?email=${encodeURIComponent(license.email)}&installation_id=${installationId}`
    );
    
    if (!response.ok) {
      return { valid: false, reason: 'validation_failed' };
    }
    
    const result = await response.json();
    
    if (result.valid) {
      // Update expiry if server returned different value
      if (result.expiry !== license.expiry) {
        await saveLicense({ ...license, expiry: result.expiry });
      }
      return { valid: true, expiry: result.expiry };
    } else {
      return { valid: false, reason: result.reason || 'invalid' };
    }
  } catch (error) {
    console.error('Error validating installation:', error);
    return { valid: false, reason: 'server_error' };
  }
}

// Get license status for display
async function getLicenseStatus() {
  const license = await loadLicense();
  
  // Check if license exists and is valid
  if (license && license.expiry) {
    const expiryDate = new Date(license.expiry);
    const now = new Date();
    
    if (expiryDate > now) {
      // License is active
      const daysRemaining = daysBetween(now, expiryDate);
      return {
        status: 'active',
        expiry: expiryDate,
        daysRemaining: daysRemaining,
        message: `${daysRemaining} days remaining — expires ${formatDate(expiryDate)}`
      };
    } else {
      // License expired
      const daysExpired = daysBetween(expiryDate, now);
      return {
        status: 'expired',
        expiry: expiryDate,
        daysExpired: daysExpired,
        message: `Expired on ${formatDate(expiryDate)} (${daysExpired} days ago)`
      };
    }
  }
  
  // Check free trial
  const freeTrialActive = await isFreeTrialActive();
  if (freeTrialActive) {
    const installDate = await getInstallDate();
    const trialEndDate = new Date(installDate);
    trialEndDate.setDate(trialEndDate.getDate() + FREE_TRIAL_DAYS);
    const daysRemaining = await getFreeTrialDaysRemaining();
    return {
      status: 'free_trial',
      daysRemaining: daysRemaining,
      expiry: trialEndDate,
      message: `${daysRemaining} days remaining — expires ${formatDate(trialEndDate)}`
    };
  }
  
  // No license, free trial expired
  return {
    status: 'none',
    message: 'No active license'
  };
}

// Check if user has LLM access
async function hasLLMAccess() {
  const license = await loadLicense();
  
  // Check license first
  if (license && license.expiry) {
    const expiryDate = new Date(license.expiry);
    const now = new Date();
    if (expiryDate > now) {
      console.log(`[License] LLM access granted - Paid license active, expires: ${expiryDate.toISOString()}`);
      return { hasAccess: true, reason: 'license' };
    } else {
      console.log(`[License] Paid license expired - Expiry: ${expiryDate.toISOString()}, Now: ${now.toISOString()}`);
    }
  } else {
    console.log(`[License] No paid license found - Checking free trial...`);
  }
  
  // Fallback to free trial
  const freeTrialActive = await isFreeTrialActive();
  if (freeTrialActive) {
    const daysRemaining = await getFreeTrialDaysRemaining();
    console.log(`[License] LLM access granted - Free trial active, ${daysRemaining} days remaining`);
    return { hasAccess: true, reason: 'free_trial' };
  }
  
  console.log(`[License] LLM access denied - No license and free trial expired`);
  return { hasAccess: false, reason: 'no_access' };
}

export {
  getInstallationId,
  getInstallDate,
  loadLicense,
  saveLicense,
  clearLicense,
  activateLicense,
  validateInstallation,
  getLicenseStatus,
  hasLLMAccess,
  isFreeTrialActive,
  getFreeTrialDaysRemaining
};
