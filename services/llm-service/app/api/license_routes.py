"""
License management API routes
"""
from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    LicenseActivationRequest,
    LicenseActivationResponse,
    LicenseValidationRequest,
    LicenseValidationResponse,
    CreateLicenseRequest
)
from app.services.license_service import license_service
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1/license", tags=["license"])


@router.post("/activate", response_model=LicenseActivationResponse)
async def activate_license(request: LicenseActivationRequest):
    """
    Activate a license for a specific installation.
    
    This endpoint:
    1. Validates the license key
    2. Checks if email matches the license
    3. Enforces 2-installation limit
    4. Handles reinstalls (same installation_id)
    5. Replaces oldest installation if at limit
    """
    logger.info(f"[API] License activation request received - Email: {request.email}, Installation ID: {request.installation_id[:8] if request.installation_id else 'None'}..., License Key: {request.license_key[:20] if request.license_key else 'None'}...")
    
    try:
        result = await license_service.activate_license(
            email=request.email,
            installation_id=request.installation_id,
            license_key=request.license_key
        )
        
        if not result["valid"]:
            logger.warning(f"[API] License activation failed - Reason: {result.get('reason')}, Message: {result.get('message')}")
            raise HTTPException(
                status_code=400,
                detail=result.get("message", "License activation failed")
            )
        
        logger.info(f"[API] License activation successful - Expiry: {result.get('expiry')}, Active count: {result.get('active_count')}")
        return LicenseActivationResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] Error activating license: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to activate license: {str(e)}"
        )


@router.post("/validate", response_model=LicenseValidationResponse)
async def validate_installation(request: LicenseValidationRequest):
    """
    Validate if an installation is still active.
    
    This endpoint:
    1. Checks if installation exists for the email
    2. Updates last_seen timestamp
    3. Returns license expiry date
    4. Validates expiry hasn't passed
    """
    logger.info(f"[API] Installation validation request - Email: {request.email}, Installation ID: {request.installation_id[:8] if request.installation_id else 'None'}...")
    
    try:
        result = await license_service.validate_installation(
            email=request.email,
            installation_id=request.installation_id
        )
        
        if not result["valid"]:
            logger.warning(f"[API] Installation validation failed - Reason: {result.get('reason')}, Message: {result.get('message')}")
            raise HTTPException(
                status_code=403,
                detail=result.get("message", "Installation validation failed")
            )
        
        logger.info(f"[API] Installation validation successful - Expiry: {result.get('expiry')}")
        return LicenseValidationResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] Error validating installation: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to validate installation: {str(e)}"
        )


@router.get("/validate")
async def validate_installation_get(email: str, installation_id: str):
    """
    GET endpoint for installation validation (for convenience).
    Same as POST /validate but using query parameters.
    """
    logger.info(f"[API] Installation validation request (GET) - Email: {email}, Installation ID: {installation_id[:8] if installation_id else 'None'}...")
    
    try:
        result = await license_service.validate_installation(
            email=email,
            installation_id=installation_id
        )
        
        if not result["valid"]:
            logger.warning(f"[API] Installation validation failed (GET) - Reason: {result.get('reason')}, Message: {result.get('message')}")
            raise HTTPException(
                status_code=403,
                detail=result.get("message", "Installation validation failed")
            )
        
        logger.info(f"[API] Installation validation successful (GET) - Expiry: {result.get('expiry')}")
        return LicenseValidationResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] Error validating installation (GET): {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to validate installation: {str(e)}"
        )


@router.post("/create", response_model=dict)
async def create_license(request: CreateLicenseRequest):
    """
    Create a new license (admin function).
    
    Use this when a user pays offline:
    1. User provides email
    2. You generate a license key
    3. Call this endpoint to create the license
    4. Send license key to user
    """
    try:
        result = await license_service.create_license(
            email=request.email,
            license_key=request.license_key,
            days=request.days
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to create license")
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating license: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create license: {str(e)}"
        )


@router.get("/installations/{email}")
async def get_installations(email: str):
    """
    Get all installations for an email (admin function).
    
    Useful for:
    - Checking how many devices a user has activated
    - Troubleshooting installation issues
    """
    try:
        installations = await license_service.get_installations(email)
        return {
            "email": email,
            "installations": installations,
            "count": len(installations)
        }
    except Exception as e:
        logger.error(f"Error getting installations: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get installations: {str(e)}"
        )
