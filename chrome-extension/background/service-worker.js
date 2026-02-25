// Background service worker
// Handles extraction API calls so they complete even when the popup closes.
// When the popup closes before the API returns, we store the result for the next load.

const PENDING_EXTRACTION_RESULTS_KEY = 'pending_extraction_results';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Popouts extension installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_ACTIONS') {
    handleExtractActions(message, sendResponse);
    return true; // Keep channel open for async sendResponse
  }
});

async function handleExtractActions(message, sendResponse) {
  const { meetingId, meetingDetails, apiUrl } = message;
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meeting_details: meetingDetails })
    });

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
    const stored = await chrome.storage.local.get(PENDING_EXTRACTION_RESULTS_KEY);
    const pending = stored[PENDING_EXTRACTION_RESULTS_KEY] || {};
    pending[String(meetingId)] = {
      result,
      timestamp: Date.now()
    };
    await chrome.storage.local.set({ [PENDING_EXTRACTION_RESULTS_KEY]: pending });

    sendResponse(result);
  } catch (error) {
    console.error('[Background] Extraction error:', error);
    sendResponse({ success: false, error: error?.message || String(error) });
  }
}
