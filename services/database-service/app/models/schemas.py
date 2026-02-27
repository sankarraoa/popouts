from pydantic import BaseModel, Field
from typing import Optional


class CreateLicenseBody(BaseModel):
    email: str = Field(..., description="User email")
    license_key: str = Field(..., description="License key")
    expiry_date: str = Field(..., description="Expiry date (ISO format)")
    status: str = Field("active", description="License status")


class CreateInstallationBody(BaseModel):
    email: str = Field(..., description="User email")
    installation_id: str = Field(..., description="Installation/device ID")


class ReplaceOldestInstallationBody(BaseModel):
    email: str = Field(..., description="User email")
    installation_id: str = Field(..., description="New installation/device ID")


class CreateLicenseWithDaysBody(BaseModel):
    email: str = Field(..., description="User email")
    days: int = Field(365, description="Days until expiry", ge=1, le=3650)


class LogApiRequestBody(BaseModel):
    service: str = Field(..., description="Service name (e.g. llm)")
    endpoint: str = Field(..., description="API endpoint")
    method: str = Field(..., description="HTTP method")
    user_identifier: str | None = Field(None, description="User/email/product_key")
    request_body: str | None = Field(None, description="Request body (truncated)")
    response_body: str | None = Field(None, description="Response body (truncated)")
    status_code: int | None = Field(None, description="HTTP status code")
    duration_ms: int | None = Field(None, description="Request duration in ms")


class CreateExtractActionItemBody(BaseModel):
    correlation_id: str = Field(..., description="Unique request correlation ID")
    license_key: str | None = Field(None, description="License key from client")
    installation_id: str | None = Field(None, description="Installation ID from client")
    input_json: str | None = Field(None, description="Full request body as JSON string")
    input_hash: str | None = Field(None, description="SHA256 hash of canonical meeting_details for dedup")


class UpdateExtractActionItemBody(BaseModel):
    correlation_id: str = Field(..., description="Correlation ID to update")
    output_json: str | None = Field(None, description="Full response body as JSON string")
    status: str = Field("completed", description="Status: completed, failed")
    error_message: str | None = Field(None, description="Error message if failed")
    http_status_code: int | None = Field(None, description="HTTP status code")
    duration_ms: int | None = Field(None, description="Request duration in ms")
