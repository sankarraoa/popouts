import httpx
import json
import asyncio
from typing import List
from app.models.schemas import MeetingDetails, NoteWithActions, ActionItem, MeetingNote
from app.services.llm_provider import LLMProvider
from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)


class ToqanClient(LLMProvider):
    """Toqan LLM provider implementation"""
    
    def __init__(self):
        self.api_key = settings.toqan_api_key
        self.timeout = settings.request_timeout
        self.base_url = "https://api.coco.prod.toqan.ai/api"
        self.poll_interval = settings.toqan_poll_interval
        
    async def extract_actions(self, meeting_details: MeetingDetails) -> List[NoteWithActions]:
        """
        Extract actions using Toqan API.
        Flow:
        1. Create conversation with meeting details as JSON
        2. Poll get_answer until status is "finished"
        3. Parse response and map actions to notes
        """
        try:
            # Prepare the user message with meeting details as JSON
            user_message = self._prepare_toqan_message(meeting_details)
            
            # Step 1: Create conversation
            conversation_id, request_id = await self._create_conversation(user_message)
            logger.info(f"Created Toqan conversation: {conversation_id}, request: {request_id}")
            
            # Step 2: Poll for answer
            answer_data = await self._get_answer(conversation_id, request_id)
            
            # Step 3: Parse response and map actions to notes
            notes_with_actions = self._parse_toqan_response(meeting_details, answer_data)
            
            return notes_with_actions
                
        except httpx.HTTPError as e:
            logger.error(f"Toqan API error: {str(e)}")
            raise Exception(f"Failed to communicate with Toqan API: {str(e)}")
        except Exception as e:
            logger.error(f"Error extracting actions with Toqan: {str(e)}")
            raise
    
    def _prepare_toqan_message(self, meeting_details: MeetingDetails) -> str:
        """
        Prepare the user message for Toqan.
        Convert meeting details to JSON string and create a prompt.
        """
        # Convert meeting details to JSON
        meeting_json = {
            "meeting_series": meeting_details.meeting_series.model_dump(exclude_none=True),
            "meeting_instance": meeting_details.meeting_instance.model_dump(exclude_none=True),
            "agenda_items": [item.model_dump(exclude_none=True) for item in meeting_details.agenda_items],
            "existing_actions": [action.model_dump(exclude_none=True) for action in meeting_details.existing_actions]
        }
        
        # Create prompt for Toqan
        prompt = f"""Extract action items from the following meeting notes in JSON format.

Meeting Details (JSON):
{json.dumps(meeting_json, indent=2, default=str)}

For each note in meeting_instance.notes, identify whether it contains action items; a note may have zero, one, or multiple actions. Action items can match the original text or be structured/improved versions, and should be grammatically correct with no spelling errors; add concise context wherever available. Write each action so it stands alone by appending the nearest, most relevant contextual noun phrase or purpose from the same sentence, earlier sentences in the same note, or the meeting title when clearly implied. Resolve pronouns such as “it,” “this,” and “that,” and any implied subjects, to the closest valid antecedent within the note; if none exists, keep the wording as-is. Prefer concrete nouns (e.g., “review meeting,” “Q1 budget”) over vague terms, and merge purpose/target phrases introduced by “for,” “to,” “in preparation for,” or “regarding.” Do not invent information beyond the note or meeting metadata, and if no clear antecedent exists, keep the action concise without added context. Use imperative voice, ensure correct grammar and spelling, and keep wording brief and non-redundant.
Return a JSON object with "notes_with_actions" array. Each item should have:
- "note_index": the index of the note (0-based)
- "note": the original note object
- "action_items": array of action items extracted from this note, each with only "text" field

Example response format:
{{
  "notes_with_actions": [
    {{
      "note_index": 0,
      "note": {{"text": "...", "created_at": null, "updated_at": null}},
      "action_items": [{{"text": "Action 1"}}, {{"text": "Action 2"}}]
    }}
  ]
}}
"""
        return prompt
    
    async def _create_conversation(self, user_message: str) -> tuple[str, str]:
        """Create a new conversation in Toqan"""
        url = f"{self.base_url}/create_conversation"
        headers = {
            "accept": "*/*",
            "content-type": "application/json",
            "X-Api-Key": self.api_key
        }
        payload = {"user_message": user_message}
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data["conversation_id"], data["request_id"]
    
    async def _get_answer(self, conversation_id: str, request_id: str) -> dict:
        """
        Poll get_answer endpoint until status is finished.
        Falls back to find_conversation if get_answer doesn't work.
        """
        # Try get_answer endpoint first (official API)
        try:
            url = f"{self.base_url}/get_answer"
            headers = {
                "accept": "*/*",
                "X-Api-Key": self.api_key
            }
            params = {
                "conversation_id": conversation_id,
                "request_id": request_id
            }
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                while True:
                    response = await client.get(url, params=params, headers=headers)
                    response.raise_for_status()
                    data = response.json()
                    
                    status = data.get("status", "unknown")
                    
                    if status == "finished":
                        return data
                    elif status == "error":
                        error_msg = data.get("error", "Unknown error")
                        raise Exception(f"Toqan API error: {error_msg}")
                    elif status == "in_progress":
                        logger.info(f"Toqan request in progress, polling again in {self.poll_interval}s...")
                        await asyncio.sleep(self.poll_interval)
                    else:
                        logger.warning(f"Unknown status: {status}, polling again...")
                        await asyncio.sleep(self.poll_interval)
        except Exception as e:
            # Fallback to find_conversation method
            logger.warning(f"get_answer failed, using find_conversation fallback: {str(e)}")
            return await self._find_conversation_response(conversation_id)
    
    async def _find_conversation_response(self, conversation_id: str) -> dict:
        """
        Alternative method: Poll find_conversation until response appears.
        Returns when conversation has more than one entry (response received).
        """
        url = f"{self.base_url}/find_conversation"
        headers = {
            "accept": "*/*",
            "content-type": "application/json",
            "X-Api-Key": self.api_key
        }
        payload = {"conversation_id": conversation_id}
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            while True:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                conversations = response.json()
                
                # Check if the response contains more than one conversation
                # (meaning the AI response has arrived)
                if len(conversations) > 1:
                    # Return the last conversation entry as the answer
                    last_entry = conversations[-1]
                    return {
                        "status": "finished",
                        "answer": last_entry.get("message", ""),
                        "conversation": conversations
                    }
                
                # Wait before checking again
                await asyncio.sleep(self.poll_interval)
    
    def _parse_toqan_response(
        self, 
        meeting_details: MeetingDetails, 
        answer_data: dict
    ) -> List[NoteWithActions]:
        """
        Parse Toqan response and map action items to their source notes.
        Toqan returns the answer in the 'answer' field, which should be JSON.
        """
        notes_with_actions = []
        
        # Extract answer from Toqan response
        answer_text = answer_data.get("answer", "")
        
        if not answer_text:
            # If no answer, return all notes with empty action items
            logger.warning("Toqan returned empty answer")
            for note in meeting_details.meeting_instance.notes:
                notes_with_actions.append(
                    NoteWithActions(note=note, action_items=[])
                )
            return notes_with_actions
        
        try:
            # Try to parse answer as JSON
            result = json.loads(answer_text)
        except json.JSONDecodeError:
            # If answer is not JSON, try to extract JSON from markdown code blocks
            logger.warning("Toqan answer is not valid JSON, attempting to extract...")
            # Look for JSON in code blocks
            if "```json" in answer_text:
                json_start = answer_text.find("```json") + 7
                json_end = answer_text.find("```", json_start)
                if json_end > json_start:
                    answer_text = answer_text[json_start:json_end].strip()
                    result = json.loads(answer_text)
            elif "```" in answer_text:
                json_start = answer_text.find("```") + 3
                json_end = answer_text.find("```", json_start)
                if json_end > json_start:
                    answer_text = answer_text[json_start:json_end].strip()
                    result = json.loads(answer_text)
            else:
                # Fallback: return all notes with empty actions
                logger.error(f"Could not parse Toqan response: {answer_text[:200]}")
                for note in meeting_details.meeting_instance.notes:
                    notes_with_actions.append(
                        NoteWithActions(note=note, action_items=[])
                    )
                return notes_with_actions
        
        # Create mapping from note_index to action items
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
        return "toqan"
