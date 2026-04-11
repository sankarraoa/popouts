"""
Interview summary: load system prompt from file + user appendix with note stats.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

_PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "interview_summary_system.txt"
INTERVIEW_SUMMARY_SYSTEM = _PROMPT_PATH.read_text(encoding="utf-8")

SPARSE_NOTES_USER_APPENDIX = """
--- Input metadata (for calibration; notes above are authoritative) ---
- Number of notes: {note_count}
- Approximate total characters in notes: {char_count}
"""


def interview_summary_user_appendix(note_count: int, char_count: int) -> str:
    return SPARSE_NOTES_USER_APPENDIX.format(
        note_count=note_count,
        char_count=char_count,
    )


def normalize_interview_llm_payload(raw: Any) -> dict:
    """
    Accept JSON object or single-element array (batch). Map legacy pros/cons keys.
    """
    data = raw
    if isinstance(data, list):
        if len(data) == 0:
            raise ValueError("Empty JSON array from LLM")
        data = data[0]
    if not isinstance(data, dict):
        raise ValueError("LLM output must be a JSON object or array of objects")

    out = dict(data)
    if "strengths" not in out and "pros" in out:
        out["strengths"] = out.pop("pros")
    if "concerns" not in out and "cons" in out:
        out["concerns"] = out.pop("cons")

    return out
