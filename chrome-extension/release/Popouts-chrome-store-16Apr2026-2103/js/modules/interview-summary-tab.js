// Interview summary tab — LLM hiring summary from all notes (overview, strengths, concerns).

import { state } from './state.js';
import { getConfig, onEnvChange } from '../config.js';
import { getMeetingSeries, saveInterviewSummaryForSeries } from '../meetings.js';
import { getMeetingDetailsAllNotes } from './meeting-details-payload.js';
import { normalizeInterviewSummaryPayload } from './interview-summary-normalize.js';
import * as licenseManager from './license.js';

const SUMMARY_TIMEOUT_MS = 120000;

/** @type {Map<string, object>} */
const summaryByMeetingId = new Map();

let _summaryStatusHideTimer = null;

let _apiUrl = null;
async function getSummarizeApiUrl() {
  if (!_apiUrl) {
    const cfg = await getConfig();
    _apiUrl = `${cfg.LLM_SERVICE_URL}/api/v1/summarize-interview`;
  }
  return _apiUrl;
}
onEnvChange(() => {
  _apiUrl = null;
});

function meetingKey() {
  return state.currentMeetingId != null ? String(state.currentMeetingId) : null;
}

function getEls() {
  return {
    empty: document.getElementById('interview-summary-empty'),
    result: document.getElementById('interview-summary-result'),
    output: document.getElementById('interview-summary-output'),
    error: document.getElementById('interview-summary-error')
  };
}

function clearError() {
  const { error } = getEls();
  if (error) {
    error.textContent = '';
    error.style.display = 'none';
  }
}

function showInterviewSummaryStatusBar(phase, message) {
  const bar = document.getElementById('extraction-status-bar');
  const text = bar?.querySelector('.extraction-status-text');
  if (!bar || !text) return;
  if (_summaryStatusHideTimer) {
    clearTimeout(_summaryStatusHideTimer);
    _summaryStatusHideTimer = null;
  }
  bar.style.display = 'flex';
  if (phase === 'loading') {
    bar.className = 'extraction-status-bar active summary-fetching';
  } else if (phase === 'success') {
    bar.className = 'extraction-status-bar active success';
  } else if (phase === 'failed') {
    bar.className = 'extraction-status-bar active failed';
  }
  text.textContent = message;
}

function scheduleHideInterviewSummaryStatusBar(delayMs) {
  if (_summaryStatusHideTimer) {
    clearTimeout(_summaryStatusHideTimer);
    _summaryStatusHideTimer = null;
  }
  _summaryStatusHideTimer = setTimeout(() => {
    _summaryStatusHideTimer = null;
    const bar = document.getElementById('extraction-status-bar');
    if (!bar) return;
    bar.style.display = 'none';
    bar.className = 'extraction-status-bar';
  }, delayMs);
}

function showError(msg) {
  const { error } = getEls();
  if (error) {
    error.textContent = msg;
    error.style.display = 'block';
  }
}

function isSectionEmpty(section) {
  const p = section?.paragraph && String(section.paragraph).trim();
  const b = section?.bullets && section.bullets.length > 0;
  return !p && !b;
}

/**
 * @param {HTMLElement} container
 * @param {string} title
 * @param {{ paragraph?: string|null, bullets?: string[] }} section
 */
function appendSection(container, title, section) {
  const h = document.createElement('h3');
  h.className = 'interview-summary-heading';
  h.textContent = title;
  container.appendChild(h);

  if (isSectionEmpty(section)) {
    const muted = document.createElement('p');
    muted.className = 'interview-summary-muted';
    muted.textContent = 'Nothing specific noted in this section.';
    container.appendChild(muted);
    return;
  }

  if (section.paragraph && String(section.paragraph).trim()) {
    const p = document.createElement('p');
    p.className = 'interview-summary-para';
    p.textContent = String(section.paragraph).trim();
    container.appendChild(p);
  }

  if (section.bullets && section.bullets.length > 0) {
    const ul = document.createElement('ul');
    ul.className = 'interview-summary-bullets';
    section.bullets.forEach((t) => {
      const s = String(t).trim();
      if (!s) return;
      const li = document.createElement('li');
      li.textContent = s;
      ul.appendChild(li);
    });
    if (ul.children.length) container.appendChild(ul);
  }
}

function renderSummaryIntoOutput(data) {
  const { output } = getEls();
  if (!output) return;
  output.replaceChildren();

  if (data.security_flag === 'suspicious_content_detected') {
    const warn = document.createElement('div');
    warn.className = 'interview-summary-security';
    warn.setAttribute('role', 'alert');
    warn.textContent =
      'Automated check: some content in the notes looked unusual. Review the raw notes and treat this summary with care.';
    output.appendChild(warn);
  }

  const parts = [];
  if (data.candidate_name && String(data.candidate_name).trim()) {
    parts.push(`Candidate: ${String(data.candidate_name).trim()}`);
  }
  if (data.role_applied_for && String(data.role_applied_for).trim()) {
    parts.push(`Role: ${String(data.role_applied_for).trim()}`);
  }
  const ev = data.evidence_level || 'sparse';
  const badge = document.createElement('span');
  badge.className = 'interview-summary-badge';
  badge.textContent = `Evidence: ${ev}`;

  const metaRow = document.createElement('div');
  metaRow.className = 'interview-summary-meta-row';
  if (parts.length) {
    const metaText = document.createElement('span');
    metaText.className = 'interview-summary-meta-text';
    metaText.textContent = parts.join(' · ');
    metaRow.appendChild(metaText);
  }
  metaRow.appendChild(badge);
  output.appendChild(metaRow);

  appendSection(output, 'Overview', data.overview);
  appendSection(output, 'Strengths', data.strengths);
  appendSection(output, 'Concerns', data.concerns);
}

function toPlainText(data) {
  const lines = [];
  if (data.security_flag === 'suspicious_content_detected') {
    lines.push('[Security flag: suspicious_content_detected]');
    lines.push('');
  }
  if (data.candidate_name && String(data.candidate_name).trim()) {
    lines.push(`Candidate: ${String(data.candidate_name).trim()}`);
  }
  if (data.role_applied_for && String(data.role_applied_for).trim()) {
    lines.push(`Role: ${String(data.role_applied_for).trim()}`);
  }
  lines.push(`Evidence level: ${data.evidence_level || 'sparse'}`);
  lines.push('');
  const block = (label, section) => {
    lines.push(label);
    lines.push('');
    if (section?.paragraph && String(section.paragraph).trim()) {
      lines.push(String(section.paragraph).trim());
      lines.push('');
    }
    if (section?.bullets && section.bullets.length) {
      section.bullets.forEach((t) => {
        const s = String(t).trim();
        if (s) lines.push(`• ${s}`);
      });
      lines.push('');
    }
  };
  block('Overview', data.overview);
  block('Strengths', data.strengths);
  block('Concerns', data.concerns);
  return lines.join('\n').trim();
}

function setBusy(busy) {
  const gen = document.getElementById('interview-summary-generate-btn');
  const regen = document.getElementById('interview-summary-regenerate-btn');
  const copy = document.getElementById('interview-summary-copy-btn');
  [gen, regen, copy].forEach((el) => {
    if (el) el.disabled = !!busy;
  });
  const { empty } = getEls();
  if (empty) empty.classList.toggle('interview-summary-loading', !!busy);
}

function syncInterviewSummaryUI() {
  const key = meetingKey();
  const { empty, result, output } = getEls();
  if (!empty || !result || !output) return;

  clearError();
  const data = key ? summaryByMeetingId.get(key) : null;
  if (data) {
    empty.style.display = 'none';
    result.style.display = 'flex';
    renderSummaryIntoOutput(data);
  } else {
    empty.style.display = 'flex';
    result.style.display = 'none';
    output.replaceChildren();
  }
}

function storeAndShow(data) {
  const key = meetingKey();
  if (!key) return;
  clearError();
  summaryByMeetingId.set(key, data);
  syncInterviewSummaryUI();
  const mid = state.currentMeetingId;
  if (mid != null) {
    void saveInterviewSummaryForSeries(mid, data).catch((e) =>
      console.error('[InterviewSummary] Failed to persist summary', e)
    );
  }
}

async function runSummarize() {
  const mid = state.currentMeetingId;
  if (mid == null) return;

  clearError();
  const access = await licenseManager.hasLLMAccess();
  if (!access.hasAccess) {
    showError('A license or active free trial is required to generate summaries.');
    return;
  }

  const meetingDetails = await getMeetingDetailsAllNotes(mid);
  if (!meetingDetails?.meeting_instance?.notes?.length) {
    showError('Add at least one note before generating a summary.');
    return;
  }

  const meeting = await getMeetingSeries(mid);
  const name = meeting?.name || 'Meeting';

  await licenseManager.getInstallationId();
  const apiUrl = await getSummarizeApiUrl();

  setBusy(true);
  showInterviewSummaryStatusBar('loading', `Generating interview summary for ${name}...`);
  try {
    const result = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Summary timed out after ${SUMMARY_TIMEOUT_MS / 1000} seconds.`));
      }, SUMMARY_TIMEOUT_MS);

      chrome.runtime.sendMessage(
        {
          type: 'SUMMARIZE_INTERVIEW',
          meetingDetails,
          apiUrl
        },
        (response) => {
          clearTimeout(timeoutId);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        }
      );
    });

    if (result.success && result.data) {
      storeAndShow(normalizeInterviewSummaryPayload(result.data));
      showInterviewSummaryStatusBar('success', `Interview summary ready for ${name}`);
      scheduleHideInterviewSummaryStatusBar(3500);
    } else {
      const errMsg = result.error || 'Summary failed.';
      showError(errMsg);
      showInterviewSummaryStatusBar('failed', errMsg);
      scheduleHideInterviewSummaryStatusBar(5000);
    }
  } catch (e) {
    const errMsg = e?.message || String(e);
    showError(errMsg);
    showInterviewSummaryStatusBar('failed', errMsg);
    scheduleHideInterviewSummaryStatusBar(5000);
  } finally {
    setBusy(false);
  }
}

/**
 * Called when the Summary tab is shown.
 */
export async function loadInterviewSummary() {
  const mid = state.currentMeetingId;
  if (mid == null) {
    syncInterviewSummaryUI();
    return;
  }
  const key = String(mid);
  const series = await getMeetingSeries(mid);
  if (series?.interviewSummary) {
    summaryByMeetingId.set(key, normalizeInterviewSummaryPayload(series.interviewSummary));
  } else {
    summaryByMeetingId.delete(key);
  }
  syncInterviewSummaryUI();
}

function wireOnce() {
  if (wireOnce.done) return;
  const gen = document.getElementById('interview-summary-generate-btn');
  const regen = document.getElementById('interview-summary-regenerate-btn');
  const copy = document.getElementById('interview-summary-copy-btn');
  if (!gen || !regen || !copy) return;

  gen.addEventListener('click', () => runSummarize());
  regen.addEventListener('click', () => runSummarize());
  copy.addEventListener('click', async () => {
    const key = meetingKey();
    const data = key ? summaryByMeetingId.get(key) : null;
    if (!data) return;
    const text = toPlainText(data);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const { output } = getEls();
      if (output) {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    }
  });

  wireOnce.done = true;
}
wireOnce.done = false;

/** Call once after DOM is ready (e.g. deferred listeners). */
export function initInterviewSummaryControls() {
  wireOnce();
}
