/**
 * Normalize summarize-interview API JSON for the extension UI.
 * Handles current shape (strengths/concerns, evidence_level, …) and legacy pros/cons.
 */

function normalizeSection(section) {
  if (section == null || typeof section !== 'object') {
    return { paragraph: null, bullets: [] };
  }
  const paragraph =
    section.paragraph != null && String(section.paragraph).trim()
      ? String(section.paragraph).trim()
      : null;
  let bullets = section.bullets;
  if (!Array.isArray(bullets)) {
    bullets = [];
  }
  bullets = bullets.map((b) => String(b).trim()).filter(Boolean);
  return { paragraph, bullets };
}

/**
 * @param {Record<string, unknown>} raw
 * @returns {object}
 */
export function normalizeInterviewSummaryPayload(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      candidate_name: null,
      role_applied_for: null,
      series_id: undefined,
      meeting_id: undefined,
      overview: { paragraph: null, bullets: [] },
      strengths: { paragraph: null, bullets: [] },
      concerns: { paragraph: null, bullets: [] },
      evidence_level: 'sparse',
      security_flag: null
    };
  }

  const strengths = raw.strengths != null ? raw.strengths : raw.pros;
  const concerns = raw.concerns != null ? raw.concerns : raw.cons;

  let evidenceLevel = raw.evidence_level;
  if (evidenceLevel !== 'rich' && evidenceLevel !== 'moderate' && evidenceLevel !== 'sparse') {
    evidenceLevel = 'sparse';
  }

  const cn = raw.candidate_name != null ? String(raw.candidate_name).trim() : '';
  const role = raw.role_applied_for != null ? String(raw.role_applied_for).trim() : '';

  return {
    candidate_name: cn || null,
    role_applied_for: role || null,
    series_id: raw.series_id,
    meeting_id: raw.meeting_id,
    overview: normalizeSection(raw.overview),
    strengths: normalizeSection(strengths),
    concerns: normalizeSection(concerns),
    evidence_level: evidenceLevel,
    security_flag:
      raw.security_flag != null && String(raw.security_flag).trim()
        ? String(raw.security_flag).trim()
        : null
  };
}
