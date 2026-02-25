import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from app.database import get_db_connection
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
        conn = await get_db_connection()
        try:
            logger.info(f"[Activate] email={email} install_id={installation_id[:8]}... key={license_key[:20]}...")

            row = await conn.execute(
                "SELECT * FROM licenses WHERE license_key = ? AND status = 'active'",
                (license_key,),
            )
            license = await row.fetchone()

            if not license:
                logger.warning(f"[Activate] Key not found: {license_key[:20]}...")
                return {"valid": False, "reason": "invalid_license", "message": "License key not found or inactive"}

            if license["email"].lower() != email.lower():
                logger.warning(f"[Activate] Email mismatch: expected={license['email']} got={email}")
                return {"valid": False, "reason": "email_mismatch", "message": "Email does not match license key"}

            expiry_date = datetime.fromisoformat(license["expiry_date"])
            if expiry_date < datetime.now():
                return {"valid": False, "reason": "license_expired", "message": f"License expired on {license['expiry_date']}"}

            rows = await conn.execute(
                "SELECT * FROM installations WHERE email = ? ORDER BY last_seen ASC",
                (email.lower(),),
            )
            existing = await rows.fetchall()

            # Reinstall check
            for inst in existing:
                if inst["installation_id"] == installation_id:
                    await conn.execute("UPDATE installations SET last_seen = CURRENT_TIMESTAMP WHERE id = ?", (inst["id"],))
                    await conn.commit()
                    logger.info(f"[Activate] Reinstall detected, count={len(existing)}")
                    return {"valid": True, "expiry": license["expiry_date"], "active_count": len(existing), "message": "License activated (reinstall detected)"}

            if len(existing) < self.MAX_INSTALLATIONS:
                await conn.execute("INSERT INTO installations (email, installation_id) VALUES (?, ?)", (email.lower(), installation_id))
                await conn.commit()
                logger.info(f"[Activate] New install, count={len(existing) + 1}")
                return {"valid": True, "expiry": license["expiry_date"], "active_count": len(existing) + 1, "message": "License activated successfully"}

            oldest = existing[0]
            await conn.execute(
                "UPDATE installations SET installation_id = ?, activated_at = CURRENT_TIMESTAMP, last_seen = CURRENT_TIMESTAMP WHERE id = ?",
                (installation_id, oldest["id"]),
            )
            await conn.commit()
            logger.info(f"[Activate] Replaced oldest install, count={self.MAX_INSTALLATIONS}")
            return {"valid": True, "expiry": license["expiry_date"], "active_count": self.MAX_INSTALLATIONS, "replaced": oldest["installation_id"], "message": "License activated (replaced oldest installation)"}

        except Exception as e:
            logger.error(f"[Activate] Error: {e}", exc_info=True)
            await conn.rollback()
            return {"valid": False, "reason": "server_error", "message": str(e)}
        finally:
            await conn.close()

    async def validate_installation(self, email: str, installation_id: str) -> Dict:
        conn = await get_db_connection()
        try:
            row = await conn.execute(
                "SELECT * FROM installations WHERE email = ? AND installation_id = ?",
                (email.lower(), installation_id),
            )
            installation = await row.fetchone()
            if not installation:
                return {"valid": False, "reason": "installation_not_found", "message": "Installation not found or deactivated"}

            await conn.execute("UPDATE installations SET last_seen = CURRENT_TIMESTAMP WHERE id = ?", (installation["id"],))

            lic_row = await conn.execute(
                "SELECT expiry_date FROM licenses WHERE email = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
                (email.lower(),),
            )
            license = await lic_row.fetchone()
            if not license:
                return {"valid": False, "reason": "no_active_license", "message": "No active license found"}

            if datetime.fromisoformat(license["expiry_date"]) < datetime.now():
                return {"valid": False, "reason": "license_expired", "expiry": license["expiry_date"], "message": f"License expired on {license['expiry_date']}"}

            await conn.commit()
            return {"valid": True, "expiry": license["expiry_date"], "message": "Installation validated"}
        except Exception as e:
            logger.error(f"[Validate] Error: {e}")
            return {"valid": False, "reason": "server_error", "message": str(e)}
        finally:
            await conn.close()

    async def list_licenses(self) -> List[Dict]:
        conn = await get_db_connection()
        try:
            rows = await conn.execute(
                "SELECT id, email, license_key, expiry_date, created_at, status FROM licenses ORDER BY created_at DESC"
            )
            records = await rows.fetchall()
            result = []
            for r in records:
                created = datetime.fromisoformat(r["created_at"]) if r["created_at"] else None
                expiry = datetime.fromisoformat(r["expiry_date"]) if r["expiry_date"] else None
                days_val = (expiry - created).days if (created and expiry) else None
                result.append({
                    "id": r["id"],
                    "email": r["email"],
                    "license_key": r["license_key"],
                    "days": days_val,
                    "created_at": r["created_at"],
                    "expiry_date": r["expiry_date"],
                    "status": r["status"],
                })
            return result
        except Exception as e:
            logger.error(f"[ListLicenses] Error: {e}")
            return []
        finally:
            await conn.close()

    async def delete_license(self, license_id: int) -> Dict:
        conn = await get_db_connection()
        try:
            row = await conn.execute("SELECT 1 FROM licenses WHERE id = ?", (license_id,))
            if not await row.fetchone():
                return {"success": False, "error": "License not found"}
            await conn.execute("DELETE FROM licenses WHERE id = ?", (license_id,))
            await conn.commit()
            logger.info(f"[Delete] License id={license_id} deleted")
            return {"success": True}
        except Exception as e:
            logger.error(f"[Delete] Error: {e}")
            await conn.rollback()
            return {"success": False, "error": str(e)}
        finally:
            await conn.close()

    async def create_license(self, email: str, license_key: Optional[str] = None, days: int = 365) -> Dict:
        conn = await get_db_connection()
        try:
            if not license_key:
                license_key, expiry_date = generate_license_key(email, days)
            else:
                expiry_date = (datetime.now() + timedelta(days=days)).isoformat()
            await conn.execute(
                """INSERT INTO licenses (email, license_key, expiry_date, status)
                   VALUES (?, ?, ?, 'active')
                   ON CONFLICT(license_key) DO UPDATE SET expiry_date = excluded.expiry_date, status = 'active'""",
                (email.lower(), license_key, expiry_date),
            )
            await conn.commit()
            logger.info(f"[Create] License for {email}, expires {expiry_date}")
            return {"success": True, "email": email, "license_key": license_key, "expiry": expiry_date}
        except Exception as e:
            logger.error(f"[Create] Error: {e}")
            await conn.rollback()
            return {"success": False, "error": str(e)}
        finally:
            await conn.close()

    async def get_installations(self, email: str) -> List[Dict]:
        conn = await get_db_connection()
        try:
            rows = await conn.execute("SELECT * FROM installations WHERE email = ? ORDER BY last_seen DESC", (email.lower(),))
            return [{"installation_id": r["installation_id"], "activated_at": r["activated_at"], "last_seen": r["last_seen"]} for r in await rows.fetchall()]
        except Exception as e:
            logger.error(f"[GetInstalls] Error: {e}")
            return []
        finally:
            await conn.close()


license_service = LicenseService()
