from pydantic import BaseModel, Field
from typing import Optional


class LicenseActivationRequest(BaseModel):
    email: str = Field(..., description="User's email address")
    installation_id: str = Field(..., description="Unique installation/device ID")
    license_key: str = Field(..., description="License key to activate")


class LicenseActivationResponse(BaseModel):
    valid: bool = Field(..., description="Whether activation was successful")
    expiry: Optional[str] = Field(None, description="License expiry date (ISO format)")
    active_count: Optional[int] = Field(None, description="Number of active installations")
    replaced: Optional[str] = Field(None, description="Installation ID that was replaced")
    reason: Optional[str] = Field(None, description="Reason if activation failed")
    message: str = Field(..., description="Human-readable message")


class LicenseValidationRequest(BaseModel):
    email: str = Field(..., description="User's email address")
    installation_id: str = Field(..., description="Installation ID to validate")


class LicenseValidationResponse(BaseModel):
    valid: bool = Field(..., description="Whether installation is valid")
    expiry: Optional[str] = Field(None, description="License expiry date (ISO format)")
    reason: Optional[str] = Field(None, description="Reason if validation failed")
    message: str = Field(..., description="Human-readable message")


class CreateLicenseRequest(BaseModel):
    email: str = Field(..., description="User's email address")
    license_key: str = Field(..., description="License key to create")
    days: int = Field(365, description="Number of days until expiry", ge=1, le=3650)
