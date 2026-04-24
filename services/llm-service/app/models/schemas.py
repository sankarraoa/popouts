from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Literal
from datetime import datetime


class MeetingNote(BaseModel):
    text: str = Field(..., description="Note text content")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class MeetingSeries(BaseModel):
    id: str = Field(..., description="Unique identifier")
    name: str = Field(..., description="Meeting name")
    type: str = Field(..., description="Meeting type (1:1s, recurring, adhoc)")
    created_at: Optional[datetime] = None


class MeetingInstance(BaseModel):
    id: str = Field(..., description="Unique identifier")
    series_id: str = Field(..., description="Parent meeting series ID")
    date: Optional[datetime] = None
    notes: List[MeetingNote] = Field(default_factory=list)
    created_at: Optional[datetime] = None


class AgendaItem(BaseModel):
    id: str = Field(..., description="Unique identifier")
    series_id: str = Field(..., description="Parent meeting series ID")
    text: str = Field(..., description="Agenda item text")
    status: str = Field(default="open", description="Status (open/closed)")
    created_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None


class ActionItem(BaseModel):
    text: str = Field(..., description="Action item text")


class NoteWithActions(BaseModel):
    note: MeetingNote = Field(..., description="The original meeting note")
    action_items: List[ActionItem] = Field(
        default_factory=list,
        description="Action items extracted from this note",
    )


class MeetingDetails(BaseModel):
    meeting_series: MeetingSeries
    meeting_instance: MeetingInstance
    agenda_items: List[AgendaItem] = Field(default_factory=list)
    existing_actions: List[ActionItem] = Field(default_factory=list)


class ActionExtractionRequest(BaseModel):
    meeting_details: MeetingDetails


class ActionExtractionResponse(BaseModel):
    series_id: str = Field(..., description="Meeting series ID")
    meeting_id: str = Field(..., description="Meeting instance ID")
    notes_with_actions: List[NoteWithActions] = Field(
        ..., description="Meeting notes with their associated extracted action items"
    )


class SummarySection(BaseModel):
    """One section of the interview summary: optional prose plus bullet list."""

    paragraph: Optional[str] = Field(
        default=None,
        description="Short paragraph(s); omit or empty if bullets alone suffice",
    )
    bullets: List[str] = Field(
        default_factory=list,
        description="Concise bullet points; use when listing fits better than prose",
    )


class InterviewSummaryCore(BaseModel):
    """LLM output (and shared fields) before server adds series/meeting ids."""

    candidate_name: Optional[str] = Field(default=None, description="Name or identifier from notes")
    role_applied_for: Optional[str] = Field(default=None, description="Role or title if stated")
    overview: SummarySection = Field(..., description="Role, background, context")
    strengths: SummarySection = Field(..., description="Strengths and positive signals")
    concerns: SummarySection = Field(..., description="Gaps, risks, or concerns")
    verdict: Optional[str] = Field(
        default=None,
        description=(
            "One or two sentences with the interviewer's read. Should begin with one of "
            "'Strong yes —', 'Hire —', 'Needs another round —', or 'No hire —' followed "
            "by a short justification."
        ),
    )
    evidence_level: Literal["rich", "moderate", "sparse"] = Field(
        default="sparse",
        description="Density of detail in the notes",
    )
    security_flag: Optional[str] = Field(
        default=None,
        description='null or "suspicious_content_detected"',
    )

    @model_validator(mode="before")
    @classmethod
    def ensure_sections(cls, data):  # type: ignore[no-untyped-def]
        if isinstance(data, dict):
            data = dict(data)
            for key in ("overview", "strengths", "concerns"):
                if key not in data or data[key] is None:
                    data[key] = {"paragraph": None, "bullets": []}
        return data

    @field_validator("evidence_level", mode="before")
    @classmethod
    def coerce_evidence_level(cls, v):  # type: ignore[no-untyped-def]
        if v in ("rich", "moderate", "sparse"):
            return v
        return "sparse"


class InterviewSummaryResponse(InterviewSummaryCore):
    series_id: str = Field(..., description="Meeting series ID")
    meeting_id: str = Field(..., description="Meeting instance ID")


class InterviewSummaryRequest(BaseModel):
    meeting_details: MeetingDetails
