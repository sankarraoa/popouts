from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    ActionExtractionRequest,
    ActionExtractionResponse
)
from app.services.llm_provider import LLMProvider
from app.services.toqan_client import ToqanClient
from app.services.openai_client import OpenAIClient
from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1", tags=["llm"])


def get_llm_provider() -> LLMProvider:
    """Factory function to get the configured LLM provider"""
    provider_name = settings.llm_provider
    
    if provider_name == "toqan":
        if not settings.toqan_api_key:
            raise HTTPException(
                status_code=500,
                detail="Toqan API key not configured"
            )
        return ToqanClient()
    elif provider_name == "openai":
        if not settings.openai_api_key:
            raise HTTPException(
                status_code=500,
                detail="OpenAI API key not configured"
            )
        return OpenAIClient()
    else:
        raise HTTPException(
            status_code=500,
            detail=f"Unknown LLM provider configured: {provider_name}"
        )


@router.post("/extract-actions", response_model=ActionExtractionResponse)
async def extract_actions(request: ActionExtractionRequest):
    """
    Extract action items from meeting notes using the configured LLM provider.
    
    The service will:
    1. Accept meeting details in JSON format
    2. Process each meeting note to extract action items
    3. Return notes with their associated action items
    
    Each note can have 0, 1, or multiple action items.
    Action items can be exactly the same as the note text or structured/improved versions.
    """
    try:
        # Get the configured LLM provider (client doesn't need to know which one)
        provider = get_llm_provider()
        
        logger.info(f"Extracting actions using {provider.get_provider_name()} provider")
        
        # Extract actions mapped to notes
        notes_with_actions = await provider.extract_actions(request.meeting_details)
        
        logger.info(
            f"Successfully extracted actions for {len(notes_with_actions)} notes"
        )
        
        # Return response with meeting IDs
        response = ActionExtractionResponse(
            series_id=request.meeting_details.meeting_series.id,
            meeting_id=request.meeting_details.meeting_instance.id,
            notes_with_actions=notes_with_actions
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting actions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to extract actions: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "llm-action-extraction",
        "version": settings.version
    }
