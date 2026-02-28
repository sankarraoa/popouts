// Background service worker
// Handles extraction API calls so they complete even when the popup closes.
// When the popup closes before the API returns, we store the result for the next load.

const PENDING_EXTRACTION_RESULTS_KEY = 'pending_extraction_results';
const LICENSE_STORAGE_KEY = 'user_license';
const INSTALLATION_ID_KEY = 'installation_id';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Popouts extension installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_ACTIONS') {
    handleExtractActions(message, sendResponse);
    return true; // Keep channel open for async sendResponse
  }
});

const FETCH_TIMEOUT_MS = 115000; // Slightly less than client timeout (2 min)

async function handleExtractActions(message, sendResponse) {
  const { meetingId, meetingDetails, apiUrl } = message;
  console.log('[Background] handleExtractActions: received', { meetingId, apiUrl });
  let timeoutId;
  try {
    const stored = await chrome.storage.local.get([LICENSE_STORAGE_KEY, INSTALLATION_ID_KEY]);
    const license = stored[LICENSE_STORAGE_KEY];
    const installationId = stored[INSTALLATION_ID_KEY];
    console.log('[Background] Storage: license_key=', !!license?.license_key, ', installation_id=', installationId || '(none)');

    const headers = { 'Content-Type': 'application/json' };
    if (license?.license_key) headers['X-License-Key'] = license.license_key;
    if (installationId) headers['X-Installation-Id'] = installationId;

    console.log('[Background] Starting fetch to', apiUrl);
    const controller = new AbortController();
    timeoutId = setTimeout(() => {
      console.log('[Background] Fetch TIMEOUT - aborting');
      controller.abort();
    }, FETCH_TIMEOUT_MS);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ meeting_details: meetingDetails }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    console.log('[Background] Fetch completed, status=', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      sendResponse({ success: false, error: `API error: ${response.status} ${errorText}` });
      return;
    }

    const data = await response.json();
    const result = {
      success: true,
      data: {
        notes_with_actions: data.notes_with_actions || [],
        series_id: data.series_id,
        meeting_id: data.meeting_id
      }
    };

    // Store result so it can be applied even if popup closed (no one to receive sendResponse)
    const pendingStored = await chrome.storage.local.get(PENDING_EXTRACTION_RESULTS_KEY);
    const pending = pendingStored[PENDING_EXTRACTION_RESULTS_KEY] || {};
    pending[String(meetingId)] = {
      result,
      timestamp: Date.now()
    };
    await chrome.storage.local.set({ [PENDING_EXTRACTION_RESULTS_KEY]: pending });

    console.log('[Background] Sending success response');
    sendResponse(result);
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    console.error('[Background] Extraction error:', error?.name, error?.message, error);
    const isTimeout = error?.name === 'AbortError';
    const errorMsg = isTimeout
      ? `Request timed out after ${FETCH_TIMEOUT_MS / 1000} seconds. The LLM service may be slow or unavailable.`
      : (error?.message || String(error));
    console.log('[Background] Sending error response:', errorMsg);
    sendResponse({ success: false, error: errorMsg });
  }
}
