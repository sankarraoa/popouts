from openai import AsyncOpenAI
from typing import List
from app.models.schemas import MeetingDetails, NoteWithActions, ActionItem
from app.services.llm_provider import LLMProvider
from app.config import settings
from app.utils.logger import get_logger
import json

logger = get_logger(__name__)


class OpenAIClient(LLMProvider):
    """OpenAI LLM provider implementation"""
    
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model
        
    async def extract_actions(self, meeting_details: MeetingDetails) -> List[NoteWithActions]:
        """
        Extract actions using OpenAI API, mapping them to specific notes.
        """
        try:
            # Prepare prompt from meeting details
            prompt = self._prepare_openai_prompt(meeting_details)
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an AI assistant that extracts action items from meeting notes. "
                                   "For each meeting note, identify if it contains action items. "
                                   "A single note can have 0, 1, or multiple action items. "
                                   "Action items can be exactly the same as the note text, or structured/improved versions. "
                                   "Return a JSON object with 'notes_with_actions' array. "
                                   "Each item should have 'note_index' (0-based), 'note' (original note object), "
                                   "and 'action_items' array with only 'text' field."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.3
            )
            
            # Parse OpenAI response
            content = response.choices[0].message.content
            result = json.loads(content)
            
            # Map action items to notes
            notes_with_actions = self._map_actions_to_notes(meeting_details, result)
            
            return notes_with_actions
            
        except Exception as e:
            logger.error(f"Error extracting actions with OpenAI: {str(e)}")
            raise
    
    def _prepare_openai_prompt(self, meeting_details: MeetingDetails) -> str:
        """Prepare prompt for OpenAI from meeting details"""
        notes_text = "\n".join([
            f"Note {i}: {note.text}" 
            for i, note in enumerate(meeting_details.meeting_instance.notes)
        ])
        
        prompt = f"""
Extract action items from the following meeting notes. Map each action item to its source note.

Meeting: {meeting_details.meeting_series.name}
Type: {meeting_details.meeting_series.type}
Date: {meeting_details.meeting_instance.date}

Agenda Items:
{chr(10).join([f"- {item.text}" for item in meeting_details.agenda_items])}

Meeting Notes (with indices):
{notes_text}

Existing Actions:
{chr(10).join([f"- {action.text}" for action in meeting_details.existing_actions])}

For each note, identify action items. A note can have:
- 0 action items (if it's just informational)
- 1 action item (same as note or structured version)
- Multiple action items (if the note contains multiple tasks)

Return a JSON object with "notes_with_actions" array. Each item should have:
- note_index: the index of the note (0-based)
- note: the original note object with text, created_at, updated_at
- action_items: array of action items extracted from this note, each with only "text" field
"""
        return prompt
    
    def _map_actions_to_notes(
        self, 
        meeting_details: MeetingDetails, 
        result: dict
    ) -> List[NoteWithActions]:
        """Map extracted actions to their source notes"""
        notes_with_actions = []
        
        # Create a mapping from OpenAI response
        notes_mapping = {}
        if "notes_with_actions" in result:
            for item in result["notes_with_actions"]:
                note_index = item.get("note_index")
                if note_index is not None:
                    action_items = [
                        ActionItem(text=action_data.get("text", ""))
                        for action_data in item.get("action_items", [])
                        if action_data.get("text")
                    ]
                    notes_mapping[note_index] = action_items
        
        # Build response with all notes, mapping actions where available
        for i, note in enumerate(meeting_details.meeting_instance.notes):
            action_items = notes_mapping.get(i, [])
            notes_with_actions.append(
                NoteWithActions(note=note, action_items=action_items)
            )
        
        return notes_with_actions
    
    def get_provider_name(self) -> str:
        return "openai"
