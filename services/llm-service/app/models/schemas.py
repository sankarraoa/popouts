from pydantic import BaseModel, Field
from typing import Optional, List
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
    """Simplified action item - just the text"""
    text: str = Field(..., description="Action item text (can be same as note or structured)")


class NoteWithActions(BaseModel):
    """A meeting note with its extracted action items"""
    note: MeetingNote = Field(..., description="The original meeting note")
    action_items: List[ActionItem] = Field(
        default_factory=list,
        description="Action items extracted from this note (can be 0, 1, or multiple)"
    )


class MeetingDetails(BaseModel):
    """Complete meeting details for LLM processing"""
    meeting_series: MeetingSeries
    meeting_instance: MeetingInstance
    agenda_items: List[AgendaItem] = Field(default_factory=list)
    existing_actions: List[ActionItem] = Field(default_factory=list)


class ActionExtractionRequest(BaseModel):
    """Request model for action extraction"""
    meeting_details: MeetingDetails


class ActionExtractionResponse(BaseModel):
    """Response model with extracted actions mapped to notes"""
    series_id: str = Field(..., description="Meeting series ID")
    meeting_id: str = Field(..., description="Meeting instance ID")
    notes_with_actions: List[NoteWithActions] = Field(
        ...,
        description="Meeting notes with their associated extracted action items"
    )


# License Management Schemas

class LicenseActivationRequest(BaseModel):
    """Request model for license activation"""
    email: str = Field(..., description="User's email address")
    installation_id: str = Field(..., description="Unique installation/device ID")
    license_key: str = Field(..., description="License key to activate")


class LicenseActivationResponse(BaseModel):
    """Response model for license activation"""
    valid: bool = Field(..., description="Whether activation was successful")
    expiry: Optional[str] = Field(None, description="License expiry date (ISO format)")
    active_count: Optional[int] = Field(None, description="Number of active installations")
    replaced: Optional[str] = Field(None, description="Installation ID that was replaced (if at limit)")
    reason: Optional[str] = Field(None, description="Reason if activation failed")
    message: str = Field(..., description="Human-readable message")


class LicenseValidationRequest(BaseModel):
    """Request model for installation validation"""
    email: str = Field(..., description="User's email address")
    installation_id: str = Field(..., description="Installation ID to validate")


class LicenseValidationResponse(BaseModel):
    """Response model for installation validation"""
    valid: bool = Field(..., description="Whether installation is valid")
    expiry: Optional[str] = Field(None, description="License expiry date (ISO format)")
    reason: Optional[str] = Field(None, description="Reason if validation failed")
    message: str = Field(..., description="Human-readable message")


class CreateLicenseRequest(BaseModel):
    """Request model for creating a license (admin)"""
    email: str = Field(..., description="User's email address")
    license_key: str = Field(..., description="License key to create")
    days: int = Field(365, description="Number of days until expiry", ge=1, le=3650)
