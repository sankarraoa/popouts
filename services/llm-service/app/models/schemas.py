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
