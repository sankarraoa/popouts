import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from app.db_client import (
    create_license as db_create_license,
    delete_license as db_delete_license,
    get_installation,
    get_installations as db_get_installations,
    get_license_by_email,
    get_license_by_key,
    insert_installation,
    list_licenses as db_list_licenses,
    replace_oldest_installation,
    update_installation_last_seen,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)

LICENSE_SALT = "popouts-license-salt-change-in-production"


def generate_license_key(email: str, days: int = 365) -> tuple:
    """Generate a license key and expiry date. Returns (license_key, expiry_iso)."""
    expiry = datetime.now() + timedelta(days=days)
    expiry_str = expiry.strftime("%Y%m%d")
    hash_input = f"{email.lower()}{LICENSE_SALT}{expiry_str}"
    hash_value = hashlib.sha256(hash_input.encode()).hexdigest()[:8].upper()
    email_clean = email.lower().replace("@", "-").replace(".", "-")
    license_key = f"{email_clean}-{expiry_str}-{hash_value}"
    return license_key, expiry.isoformat()


class LicenseService:
    MAX_INSTALLATIONS = 2

    async def activate_license(self, email: str, installation_id: str, license_key: str) -> Dict:
        try:
            logger.info(f"[Activate] email={email} install_id={installation_id[:8]}... key={license_key[:20]}...")

            license = await get_license_by_key(license_key)
            if not license:
                logger.warning(f"[Activate] Key not found: {license_key[:20]}...")
                return {"valid": False, "reason": "invalid_license", "message": "License key not found or inactive"}

            if license["email"].lower() != email.lower():
                logger.warning(f"[Activate] Email mismatch: expected={license['email']} got={email}")
                return {"valid": False, "reason": "email_mismatch", "message": "Email does not match license key"}

            expiry_date = datetime.fromisoformat(license["expiry_date"])
            if expiry_date < datetime.now():
                return {"valid": False, "reason": "license_expired", "message": f"License expired on {license['expiry_date']}"}

            installations = await db_get_installations(email)
            # Sort by last_seen ASC (oldest first) for replace logic
            existing = sorted(installations, key=lambda x: x.get("last_seen") or "")

            # Reinstall check
            for inst in existing:
                if inst["installation_id"] == installation_id:
                    await update_installation_last_seen(email, installation_id)
                    logger.info(f"[Activate] Reinstall detected, count={len(existing)}")
                    return {"valid": True, "expiry": license["expiry_date"], "active_count": len(existing), "message": "License activated (reinstall detected)"}

            if len(existing) < self.MAX_INSTALLATIONS:
                ok = await insert_installation(email, installation_id)
                if not ok:
                    return {"valid": False, "reason": "server_error", "message": "Failed to insert installation"}
                logger.info(f"[Activate] New install, count={len(existing) + 1}")
                return {"valid": True, "expiry": license["expiry_date"], "active_count": len(existing) + 1, "message": "License activated successfully"}

            replaced_id = await replace_oldest_installation(email, installation_id)
            if not replaced_id:
                return {"valid": False, "reason": "server_error", "message": "Failed to replace installation"}
            logger.info(f"[Activate] Replaced oldest install, count={self.MAX_INSTALLATIONS}")
            return {"valid": True, "expiry": license["expiry_date"], "active_count": self.MAX_INSTALLATIONS, "replaced": replaced_id, "message": "License activated (replaced oldest installation)"}

        except Exception as e:
            logger.error(f"[Activate] Error: {e}", exc_info=True)
            return {"valid": False, "reason": "server_error", "message": str(e)}

    async def validate_installation(self, email: str, installation_id: str) -> Dict:
        try:
            installation = await get_installation(email, installation_id)
            if not installation:
                return {"valid": False, "reason": "installation_not_found", "message": "Installation not found or deactivated"}

            await update_installation_last_seen(email, installation_id)

            license = await get_license_by_email(email)
            if not license:
                return {"valid": False, "reason": "no_active_license", "message": "No active license found"}

            if datetime.fromisoformat(license["expiry_date"]) < datetime.now():
                return {"valid": False, "reason": "license_expired", "expiry": license["expiry_date"], "message": f"License expired on {license['expiry_date']}"}

            return {"valid": True, "expiry": license["expiry_date"], "message": "Installation validated"}
        except Exception as e:
            logger.error(f"[Validate] Error: {e}")
            return {"valid": False, "reason": "server_error", "message": str(e)}

    async def list_licenses(self) -> List[Dict]:
        try:
            records = await db_list_licenses()
            result = []
            for r in records:
                created = datetime.fromisoformat(r["created_at"]) if r.get("created_at") else None
                expiry = datetime.fromisoformat(r["expiry_date"]) if r.get("expiry_date") else None
                days_val = (expiry - created).days if (created and expiry) else None
                result.append({
                    "id": r["id"],
                    "email": r["email"],
                    "license_key": r["license_key"],
                    "days": days_val,
                    "created_at": r.get("created_at"),
                    "expiry_date": r.get("expiry_date"),
                    "status": r.get("status", "active"),
                })
            return result
        except Exception as e:
            logger.error(f"[ListLicenses] Error: {e}")
            return []

    async def delete_license(self, license_id: int) -> Dict:
        try:
            result = await db_delete_license(license_id)
            if result is None:
                return {"success": False, "error": "License not found"}
            logger.info(f"[Delete] License id={license_id} deleted")
            return {"success": True}
        except Exception as e:
            logger.error(f"[Delete] Error: {e}")
            return {"success": False, "error": str(e)}

    async def create_license(self, email: str, license_key: Optional[str] = None, days: int = 365) -> Dict:
        try:
            if not license_key:
                license_key, expiry_date = generate_license_key(email, days)
            else:
                expiry_date = (datetime.now() + timedelta(days=days)).isoformat()
            result = await db_create_license(email.lower(), license_key, expiry_date, "active")
            if not result.get("success"):
                return {"success": False, "error": result.get("error", "Unknown error")}
            logger.info(f"[Create] License for {email}, expires {expiry_date}")
            return {"success": True, "email": email, "license_key": license_key, "expiry": expiry_date}
        except Exception as e:
            logger.error(f"[Create] Error: {e}")
            return {"success": False, "error": str(e)}

    async def get_installations(self, email: str) -> List[Dict]:
        try:
            installations = await db_get_installations(email)
            return [{"installation_id": r["installation_id"], "activated_at": r["activated_at"], "last_seen": r["last_seen"]} for r in installations]
        except Exception as e:
            logger.error(f"[GetInstalls] Error: {e}")
            return []


license_service = LicenseService()
