from abc import ABC, abstractmethod
from typing import List
from app.models.schemas import MeetingDetails, NoteWithActions


class LLMProvider(ABC):
    """Abstract base class for LLM providers"""
    
    @abstractmethod
    async def extract_actions(self, meeting_details: MeetingDetails) -> List[NoteWithActions]:
        """
        Extract action items from meeting details, mapping them to specific notes.
        
        Args:
            meeting_details: Complete meeting information
            
        Returns:
            List of notes with their associated action items.
            Each note can have 0, 1, or multiple action items.
        """
        pass
    
    @abstractmethod
    def get_provider_name(self) -> str:
        """Return the name of the provider"""
        pass
