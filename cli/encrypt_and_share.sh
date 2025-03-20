#!/bin/bash

# Configuration
API_URL="https://secret.tool2tool.com/api/create"  # Replace with your deployed URL
MASTER_KEY="your-master-key"                    # Replace with a key for local encryption (e.g., 32-byte base64)
EXPIRY=86400                                    # Default: 1 day in seconds
MAX_ATTEMPTS=3                                  # Default: 3 attempts

# Check for required tools
command -v openssl >/dev/null 2>&1 || { echo "Error: openssl is required."; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "Error: curl is required."; exit 1; }
command -v base64 >/dev/null 2>&1 || { echo "Error: base64 is required."; exit 1; }

# Prompt for secret
read -s -p "Enter your secret: " SECRET
echo

# Generate IV (12 bytes for AES-GCM)
IV=$(openssl rand -hex 12)
IV_BASE64=$(echo -n "$IV" | xxd -r -p | base64)

# Encrypt the secret with AES-GCM
ENCRYPTED=$(echo -n "$SECRET" | openssl enc -aes-256-gcm -iv "$IV" -K "$(echo -n "$MASTER_KEY" | xxd -p)" -e | base64)

# Post to API
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"encrypted\": \"$ENCRYPTED\", \"iv\": \"$IV_BASE64\", \"expiry\": $EXPIRY, \"maxAttempts\": $MAX_ATTEMPTS, \"isE2EE\": true}")

# Parse response
SUCCESS=$(echo "$RESPONSE" | grep -o '"success":true')
if [ -n "$SUCCESS" ]; then
  CODE=$(echo "$RESPONSE" | grep -o '"code":"[^"]*"' | cut -d'"' -f4)
  OTP=$(echo "$RESPONSE" | grep -o '"otp":"[^"]*"' | cut -d'"' -f4)
  echo "Secret shared successfully!"
  echo "Share this link: https://your-pages-domain/retrieve.html?code=$CODE"
  echo "OTP: $OTP"
else
  MESSAGE=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
  echo "Error: $MESSAGE"
fi