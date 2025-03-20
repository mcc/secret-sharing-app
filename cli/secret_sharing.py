import sys
import base64
import hashlib
import json
import requests
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import os

# Encrypt secret with AES-GCM (no padding, compatible with Web Crypto API)
def encrypt_secret(secret, password):
    backend = default_backend()
    salt = b'salt'  # Same salt as in JavaScript
    key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000, dklen=32)
    iv = os.urandom(12)  # 12-byte IV for GCM
    cipher = Cipher(algorithms.AES(key), modes.GCM(iv), backend=backend)
    encryptor = cipher.encryptor()
    ciphertext = encryptor.update(secret.encode()) + encryptor.finalize()
    # Combine ciphertext and tag (16 bytes) as Web Crypto API does
    encrypted = ciphertext + encryptor.tag[:16]
    return base64.b64encode(iv).decode(), base64.b64encode(encrypted).decode()

# Decrypt secret with AES-GCM (no padding, compatible with Web Crypto API)
def decrypt_secret(encrypted, iv, password):
    backend = default_backend()
    salt = b'salt'  # Same salt as in JavaScript
    key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000, dklen=32)
    iv_bytes = base64.b64decode(iv)
    encrypted_bytes = base64.b64decode(encrypted)
    # Split ciphertext and tag (last 16 bytes are the tag)
    ciphertext = encrypted_bytes[:-16]
    tag = encrypted_bytes[-16:]
    cipher = Cipher(algorithms.AES(key), modes.GCM(iv_bytes, tag), backend=backend)
    decryptor = cipher.decryptor()
    plaintext = decryptor.update(ciphertext) + decryptor.finalize()
    return plaintext.decode()

# Post secret to API
def post_secret(url, master_password, secret):
    iv, encrypted = encrypt_secret(secret, master_password)
    payload = {
        "encrypted": encrypted,
        "iv": iv,
        "expiry": 86400,  # 1 day default
        "maxAttempts": 3,
        "isE2EE": True
    }
    response = requests.post(f"{url}/api/create", json=payload)
    data = response.json()
    if data.get("success"):
        link = f"{url}/retrieve.html?code={data['code']}"
        print(f"Secret created!\nLink: {link}\nOTP: {data['otp']}")
    else:
        print(f"Error: {data.get('message')}")

# Retrieve and decrypt secret
def retrieve_secret(url, master_password, code, otp):
    response = requests.get(f"{url}/api/retrieve?code={code}&otp={otp}")
    data = response.json()
    if data.get("success"):
        decrypted = decrypt_secret(data["encrypted"], data["iv"], master_password)
        print(f"Decrypted Secret: {decrypted}")
    else:
        print(f"Error: {data.get('message')}")

# Main script
if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else input("Enter API URL (e.g., https://your-app.pages.dev): ")
    master_password = sys.argv[2] if len(sys.argv) > 2 else input("Enter master password: ")
    action = input("Choose action (1 = Post Secret, 2 = Retrieve Secret): ")

    if action == "1":
        secret = sys.argv[3] if len(sys.argv) > 3 else input("Enter secret: ")
        post_secret(url, master_password, secret)
    elif action == "2":
        code = sys.argv[3] if len(sys.argv) > 3 else input("Enter secret code: ")
        otp = sys.argv[4] if len(sys.argv) > 4 else input("Enter OTP: ")
        retrieve_secret(url, master_password, code, otp)
    else:
        print("Invalid action. Use 1 or 2.")