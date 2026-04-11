"""
Parse JSON returned by LLMs (Toqan/OpenAI). Models often emit invalid JSON:
unescaped newlines/control characters inside strings, markdown fences, truncation.
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _strip_fences(text: str) -> str:
    t = text.strip()
    if "```json" in t:
        start = t.find("```json") + 7
        end = t.find("```", start)
        if end > start:
            return t[start:end].strip()
    if "```" in t:
        start = t.find("```") + 3
        end = t.find("```", start)
        if end > start:
            return t[start:end].strip()
    return t


def _brace_slice(text: str) -> str | None:
    a = text.find("{")
    b = text.rfind("}")
    if a >= 0 and b > a:
        return text[a : b + 1]
    return None


def _coerce_root(data: Any) -> dict[str, Any] | None:
    if isinstance(data, dict):
        return data
    if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
        return data[0]
    return None


def parse_llm_json_object(answer_text: str) -> dict[str, Any]:
    """
    Best-effort parse of a single JSON object from LLM text.
    Uses stdlib json.loads first, then json-repair for malformed output.
    """
    if answer_text is None or not str(answer_text).strip():
        raise ValueError("Empty LLM answer for JSON parsing")

    raw = str(answer_text).strip().lstrip("\ufeff")
    candidates: list[str] = []
    for c in (raw, _strip_fences(raw)):
        if c and c not in candidates:
            candidates.append(c)
    br = _brace_slice(_strip_fences(raw)) or _brace_slice(raw)
    if br and br not in candidates:
        candidates.append(br)

    for c in candidates:
        if not c:
            continue
        try:
            data = json.loads(c)
            out = _coerce_root(data)
            if out is not None:
                return out
        except json.JSONDecodeError as e:
            logger.debug("json.loads failed: %s", e)

    try:
        from json_repair import loads as json_repair_loads
    except ImportError:
        logger.warning("json_repair package not installed; cannot recover malformed LLM JSON")
        json_repair_loads = None

    if json_repair_loads is not None:
        for c in candidates:
            if not c:
                continue
            try:
                data = json_repair_loads(c)
                out = _coerce_root(data)
                if out is not None:
                    return out
            except Exception as e:
                logger.debug("json_repair.loads failed: %s", e)

    snippet = raw[:1200] + ("…" if len(raw) > 1200 else "")
    raise ValueError(
        "Could not parse interview summary JSON from LLM (invalid control characters, "
        f"truncation, or bad structure). Snippet: {snippet}"
    )
