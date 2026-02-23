from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    LicenseActivationRequest, LicenseActivationResponse,
    LicenseValidationRequest, LicenseValidationResponse,
    CreateLicenseRequest,
)
from app.services.license_service import license_service
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1/license", tags=["license"])


@router.post("/activate", response_model=LicenseActivationResponse)
async def activate_license(request: LicenseActivationRequest):
    result = await license_service.activate_license(
        email=request.email, installation_id=request.installation_id, license_key=request.license_key,
    )
    if not result["valid"]:
        raise HTTPException(status_code=400, detail=result.get("message"))
    return LicenseActivationResponse(**result)


@router.post("/validate", response_model=LicenseValidationResponse)
async def validate_installation(request: LicenseValidationRequest):
    result = await license_service.validate_installation(email=request.email, installation_id=request.installation_id)
    if not result["valid"]:
        raise HTTPException(status_code=403, detail=result.get("message"))
    return LicenseValidationResponse(**result)


@router.get("/validate")
async def validate_installation_get(email: str, installation_id: str):
    result = await license_service.validate_installation(email=email, installation_id=installation_id)
    if not result["valid"]:
        raise HTTPException(status_code=403, detail=result.get("message"))
    return LicenseValidationResponse(**result)


@router.post("/create", response_model=dict)
async def create_license(request: CreateLicenseRequest):
    result = await license_service.create_license(email=request.email, license_key=request.license_key, days=request.days)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@router.get("/installations/{email}")
async def get_installations(email: str):
    installations = await license_service.get_installations(email)
    return {"email": email, "installations": installations, "count": len(installations)}
