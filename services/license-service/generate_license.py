#!/usr/bin/env python3
"""
License Key Generation Utility

Usage:
    python generate_license.py user@example.com 365
"""
import sys
import hashlib
from datetime import datetime, timedelta


def generate_license_key(email: str, days: int = 365, secret_salt: str = "your-secret-salt-change-this"):
    expiry = datetime.now() + timedelta(days=days)
    expiry_str = expiry.strftime("%Y%m%d")
    hash_input = f"{email.lower()}{secret_salt}{expiry_str}"
    hash_value = hashlib.sha256(hash_input.encode()).hexdigest()[:8].upper()
    email_clean = email.lower().replace("@", "-").replace(".", "-")
    license_key = f"{email_clean}-{expiry_str}-{hash_value}"
    return license_key, expiry.isoformat()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python generate_license.py <email> [days]")
        sys.exit(1)

    email = sys.argv[1]
    days = int(sys.argv[2]) if len(sys.argv) > 2 else 365
    license_key, expiry = generate_license_key(email, days)

    print(f"\nEmail:       {email}")
    print(f"License Key: {license_key}")
    print(f"Expires:     {expiry}")
    print(f"\nCreate in database:")
    print(f'curl -X POST http://localhost:8001/api/v1/license/create \\')
    print(f'  -H "Content-Type: application/json" \\')
    print(f'  -d \'{{"email": "{email}", "license_key": "{license_key}", "days": {days}}}\'')
    print()
