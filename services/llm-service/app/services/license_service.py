"""
License management service for handling license activation and validation
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from app.database import get_db_connection
from app.utils.logger import get_logger

logger = get_logger(__name__)


class LicenseService:
    """Service for managing licenses and installations"""
    
    MAX_INSTALLATIONS = 2
    
    async def activate_license(
        self, 
        email: str, 
        installation_id: str, 
        license_key: str
    ) -> Dict:
        """
        Activate a license for a specific installation
        
        Args:
            email: User's email address
            installation_id: Unique device/browser installation ID
            license_key: License key provided by user
            
        Returns:
            Dict with activation result
        """
        conn = await get_db_connection()
        try:
            logger.info(f"[License Activation] Starting activation - Email: {email}, Installation ID: {installation_id[:8]}..., License Key: {license_key[:20]}...")
            
            # 1. Validate license key exists and is active
            # First try exact match, then try email extraction from key
            license_row = await conn.execute(
                """
                SELECT * FROM licenses 
                WHERE license_key = ? AND status = 'active'
                """,
                (license_key,)
            )
            license = await license_row.fetchone()
            
            if not license:
                logger.warning(f"[License Activation] License key not found or inactive - Key: {license_key[:20]}...")
                return {
                    "valid": False,
                    "reason": "invalid_license",
                    "message": "License key not found or inactive"
                }
            
            logger.info(f"[License Activation] License found - Email: {license['email']}, Expiry: {license['expiry_date']}")
            
            # Verify email matches (license key should encode email)
            if license["email"].lower() != email.lower():
                logger.warning(f"[License Activation] Email mismatch - License email: {license['email']}, Provided email: {email}")
                return {
                    "valid": False,
                    "reason": "email_mismatch",
                    "message": "Email does not match license key"
                }
            
            # 2. Check if expiry is still valid
            expiry_date = datetime.fromisoformat(license["expiry_date"])
            if expiry_date < datetime.now():
                logger.warning(f"[License Activation] License expired - Expiry: {license['expiry_date']}, Now: {datetime.now().isoformat()}")
                return {
                    "valid": False,
                    "reason": "license_expired",
                    "message": f"License expired on {license['expiry_date']}"
                }
            
            logger.info(f"[License Activation] License expiry valid - Expires: {license['expiry_date']}")
            
            # 3. Check existing installations for this email
            existing_rows = await conn.execute(
                """
                SELECT * FROM installations 
                WHERE email = ? 
                ORDER BY last_seen ASC
                """,
                (email.lower(),)
            )
            existing = await existing_rows.fetchall()
            
            logger.info(f"[License Activation] Found {len(existing)} existing installations for email: {email}")
            
            # 4. Check if this installation_id already exists (reinstall)
            existing_install = None
            for inst in existing:
                if inst["installation_id"] == installation_id:
                    existing_install = inst
                    break
            
            if existing_install:
                # Same device reinstalled - just update last_seen
                logger.info(f"[License Activation] Reinstall detected - Installation ID: {installation_id[:8]}...")
                await conn.execute(
                    """
                    UPDATE installations 
                    SET last_seen = CURRENT_TIMESTAMP 
                    WHERE id = ?
                    """,
                    (existing_install["id"],)
                )
                await conn.commit()
                logger.info(f"[License Activation] License activated successfully (reinstall) - Active installations: {len(existing)}")
                return {
                    "valid": True,
                    "expiry": license["expiry_date"],
                    "active_count": len(existing),
                    "message": "License activated (reinstall detected)"
                }
            
            # 5. New device - check installation limit
            if len(existing) < self.MAX_INSTALLATIONS:
                # Under limit - add new installation
                logger.info(f"[License Activation] Adding new installation - Current count: {len(existing)}, Max: {self.MAX_INSTALLATIONS}")
                await conn.execute(
                    """
                    INSERT INTO installations (email, installation_id)
                    VALUES (?, ?)
                    """,
                    (email.lower(), installation_id)
                )
                await conn.commit()
                logger.info(f"[License Activation] License activated successfully - Active installations: {len(existing) + 1}")
                return {
                    "valid": True,
                    "expiry": license["expiry_date"],
                    "active_count": len(existing) + 1,
                    "message": "License activated successfully"
                }
            
            # 6. At limit - replace oldest installation
            oldest = existing[0]
            logger.info(f"[License Activation] At installation limit - Replacing oldest: {oldest['installation_id'][:8]}...")
            await conn.execute(
                """
                UPDATE installations 
                SET installation_id = ?, activated_at = CURRENT_TIMESTAMP, last_seen = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (installation_id, oldest["id"])
            )
            await conn.commit()
            logger.info(f"[License Activation] License activated (replaced oldest) - Active installations: {self.MAX_INSTALLATIONS}")
            return {
                "valid": True,
                "expiry": license["expiry_date"],
                "active_count": self.MAX_INSTALLATIONS,
                "replaced": oldest["installation_id"],
                "message": f"License activated (replaced oldest installation)"
            }
            
        except Exception as e:
            logger.error(f"[License Activation] Error activating license: {e}", exc_info=True)
            await conn.rollback()
            return {
                "valid": False,
                "reason": "server_error",
                "message": str(e)
            }
        finally:
            await conn.close()
    
    async def validate_installation(
        self, 
        email: str, 
        installation_id: str
    ) -> Dict:
        """
        Validate if an installation is still active
        
        Args:
            email: User's email address
            installation_id: Installation ID to validate
            
        Returns:
            Dict with validation result
        """
        conn = await get_db_connection()
        try:
            # Check if installation exists
            install_row = await conn.execute(
                """
                SELECT * FROM installations 
                WHERE email = ? AND installation_id = ?
                """,
                (email.lower(), installation_id)
            )
            installation = await install_row.fetchone()
            
            if not installation:
                return {
                    "valid": False,
                    "reason": "installation_not_found",
                    "message": "Installation not found or deactivated"
                }
            
            # Update last_seen
            await conn.execute(
                """
                UPDATE installations 
                SET last_seen = CURRENT_TIMESTAMP 
                WHERE id = ?
                """,
                (installation["id"],)
            )
            
            # Get license expiry
            license_row = await conn.execute(
                """
                SELECT expiry_date, status FROM licenses 
                WHERE email = ? AND status = 'active'
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (email.lower(),)
            )
            license = await license_row.fetchone()
            
            if not license:
                return {
                    "valid": False,
                    "reason": "no_active_license",
                    "message": "No active license found"
                }
            
            # Check expiry
            expiry_date = datetime.fromisoformat(license["expiry_date"])
            if expiry_date < datetime.now():
                return {
                    "valid": False,
                    "reason": "license_expired",
                    "expiry": license["expiry_date"],
                    "message": f"License expired on {license['expiry_date']}"
                }
            
            await conn.commit()
            return {
                "valid": True,
                "expiry": license["expiry_date"],
                "message": "Installation validated"
            }
            
        except Exception as e:
            logger.error(f"Error validating installation: {e}")
            return {
                "valid": False,
                "reason": "server_error",
                "message": str(e)
            }
        finally:
            await conn.close()
    
    async def create_license(
        self,
        email: str,
        license_key: str,
        days: int = 365
    ) -> Dict:
        """
        Create a new license (admin function)
        
        Args:
            email: User's email
            license_key: License key to create
            days: Number of days until expiry (default 365)
            
        Returns:
            Dict with creation result
        """
        conn = await get_db_connection()
        try:
            expiry_date = (datetime.now() + timedelta(days=days)).isoformat()
            
            await conn.execute(
                """
                INSERT INTO licenses (email, license_key, expiry_date, status)
                VALUES (?, ?, ?, 'active')
                ON CONFLICT(email, license_key) DO UPDATE SET
                    expiry_date = excluded.expiry_date,
                    status = 'active'
                """,
                (email.lower(), license_key, expiry_date)
            )
            await conn.commit()
            
            logger.info(f"License created for {email}, expires {expiry_date}")
            return {
                "success": True,
                "email": email,
                "license_key": license_key,
                "expiry": expiry_date
            }
        except Exception as e:
            logger.error(f"Error creating license: {e}")
            await conn.rollback()
            return {
                "success": False,
                "error": str(e)
            }
        finally:
            await conn.close()
    
    async def get_installations(self, email: str) -> List[Dict]:
        """
        Get all installations for an email (admin function)
        
        Args:
            email: User's email
            
        Returns:
            List of installation records
        """
        conn = await get_db_connection()
        try:
            rows = await conn.execute(
                """
                SELECT * FROM installations 
                WHERE email = ?
                ORDER BY last_seen DESC
                """,
                (email.lower(),)
            )
            installations = await rows.fetchall()
            return [
                {
                    "installation_id": inst["installation_id"],
                    "activated_at": inst["activated_at"],
                    "last_seen": inst["last_seen"]
                }
                for inst in installations
            ]
        except Exception as e:
            logger.error(f"Error getting installations: {e}")
            return []
        finally:
            await conn.close()


# Singleton instance
license_service = LicenseService()
