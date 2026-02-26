import os
import httpx
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr

app = FastAPI()

PUBLIC_DIR = Path(__file__).parent / "public"

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
NOTIFY_EMAIL = os.getenv("NOTIFY_EMAIL", "asankarrao@gmail.com")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@inform.popouts.app")


class AccessRequest(BaseModel):
    email: EmailStr


class LicenseRequest(BaseModel):
    email: EmailStr


class ContactSupportRequest(BaseModel):
    email: EmailStr
    message: str = ""


@app.post("/api/request-access")
async def request_access(req: AccessRequest):
    if not RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="Email not configured")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": FROM_EMAIL,
                "to": NOTIFY_EMAIL,
                "subject": f"Popouts Beta Access Request from {req.email}",
                "text": (
                    f"Hi,\n\n"
                    f"Someone wants to keep using Popouts after the beta.\n\n"
                    f"Email: {req.email}\n\n"
                    f"You can follow up with them directly.\n\n"
                    f"Best,\n"
                    f"Popouts Website"
                ),
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to send email")

    return {"status": "ok"}


@app.post("/api/request-license")
async def request_license(req: LicenseRequest):
    """Extension: user requests a new license key when theirs expired."""
    if not RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="Email not configured")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": FROM_EMAIL,
                "to": NOTIFY_EMAIL,
                "subject": f"Popouts License Key Request from {req.email}",
                "text": (
                    f"Hi,\n\n"
                    f"Someone has requested a new license key for Popouts.\n\n"
                    f"Email: {req.email}\n\n"
                    f"You can follow up with them directly to provide a new license key.\n\n"
                    f"Best,\n"
                    f"Popouts Extension"
                ),
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to send email")

    return {"status": "ok"}


@app.post("/api/contact-support")
async def contact_support(req: ContactSupportRequest):
    """Help page: user submits email and message; sends to support."""
    if not RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="Email not configured")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": FROM_EMAIL,
                "to": NOTIFY_EMAIL,
                "subject": f"Popouts Support Request from {req.email}",
                "text": (
                    f"Hi,\n\n"
                    f"A user has contacted support from the Popouts help page.\n\n"
                    f"Email: {req.email}\n\n"
                    f"Message:\n{req.message or '(no message)'}\n\n"
                    f"Best,\n"
                    f"Popouts Website"
                ),
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to send email")

    return {"status": "ok"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/privacy")
async def privacy():
    """Privacy policy page — required for Chrome Web Store."""
    return FileResponse(PUBLIC_DIR / "privacy.html")


@app.get("/help")
async def help_page():
    """Help page with FAQs and contact support."""
    return FileResponse(PUBLIC_DIR / "help.html")


app.mount("/", StaticFiles(directory="public", html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run("app:app", host="0.0.0.0", port=port)
