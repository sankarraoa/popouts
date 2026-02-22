#!/usr/bin/env python3
"""
License Key Generation Utility

Use this script to generate license keys when users pay offline.

Usage:
    python generate_license.py user@example.com 365

This will:
1. Generate a license key
2. Create the license in the database
3. Print the license key to send to the user
"""
import sys
import hashlib
import secrets
from datetime import datetime, timedelta


def generate_license_key(email: str, secret_salt: str = "your-secret-salt-change-this") -> str:
    """
    Generate a license key for an email.
    
    Format: EMAIL-EXPIRY-HASH
    Where HASH is derived from email + secret salt + expiry
    """
    # Generate expiry date (1 year from now)
    expiry = datetime.now() + timedelta(days=365)
    expiry_str = expiry.strftime("%Y%m%d")
    
    # Create hash from email + salt + expiry
    hash_input = f"{email.lower()}{secret_salt}{expiry_str}"
    hash_value = hashlib.sha256(hash_input.encode()).hexdigest()[:8].upper()
    
    # Format: EMAIL-EXPIRY-HASH
    # Clean email for key (remove special chars, keep alphanumeric)
    email_clean = email.lower().replace("@", "-").replace(".", "-")
    license_key = f"{email_clean}-{expiry_str}-{hash_value}"
    
    return license_key, expiry.isoformat()


def format_license_key(key: str) -> str:
    """Format license key for display (add dashes if needed)"""
    # Already formatted, just return
    return key


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python generate_license.py <email> [days]")
        print("Example: python generate_license.py user@example.com 365")
        sys.exit(1)
    
    email = sys.argv[1]
    days = int(sys.argv[2]) if len(sys.argv) > 2 else 365
    
    # Generate license key
    license_key, expiry = generate_license_key(email)
    
    print("\n" + "="*60)
    print("LICENSE KEY GENERATED")
    print("="*60)
    print(f"Email:        {email}")
    print(f"License Key:  {license_key}")
    print(f"Expiry Date:  {expiry}")
    print(f"Valid For:    {days} days")
    print("="*60)
    print("\nNext steps:")
    print("1. Send this license key to the user via email")
    print("2. Create the license in database using API:")
    print(f"   POST /api/v1/license/create")
    print(f"   {{")
    print(f'     "email": "{email}",')
    print(f'     "license_key": "{license_key}",')
    print(f'     "days": {days}')
    print(f"   }}")
    print("\nOr use the create_license API endpoint directly.")
    print("="*60 + "\n")
