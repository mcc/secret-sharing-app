const crypto = require('crypto');

// Encrypt secret with AES-GCM (no padding, tag appended)
async function encryptSecret(secret, password) {
  const salt = Buffer.from('salt'); // Same salt as in web app
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const iv = crypto.randomBytes(12); // 12-byte IV
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16-byte tag
  const combined = Buffer.concat([encrypted, tag]); // Append tag to ciphertext
  return { iv: iv.toString('base64'), data: combined.toString('base64') };
}

// Decrypt secret with AES-GCM (extract tag from combined data)
async function decryptSecret(encrypted, iv, password) {
  const salt = Buffer.from('salt'); // Same salt as in web app
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const encryptedBytes = Buffer.from(encrypted, 'base64');
  const ciphertext = encryptedBytes.slice(0, -16); // All but last 16 bytes
  const tag = encryptedBytes.slice(-16); // Last 16 bytes are the tag
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

// Post secret to API
async function postSecret(url, masterPassword, secret) {
  const { iv, data } = await encryptSecret(secret, masterPassword);
  const payload = {
    encrypted: data,
    iv: iv,
    expiry: 86400, // 1 day default
    maxAttempts: 3,
    isE2EE: true
  };
  const response = await fetch(`${url}/api/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (result.success) {
    const link = `${url}/retrieve.html?code=${result.code}`;
    console.log(`Secret created!\nLink: ${link}\nOTP: ${result.otp}`);
  } else {
    console.log(`Error: ${result.message}`);
  }
}

// Retrieve and decrypt secret
async function retrieveSecret(url, masterPassword, code, otp) {
  const response = await fetch(`${url}/api/retrieve?code=${code}&otp=${otp}`);
  const data = await response.json();
  if (data.success) {
    const decrypted = await decryptSecret(data.encrypted, data.iv, masterPassword);
    console.log(`Decrypted Secret: ${decrypted}`);
  } else {
    console.log(`Error: ${data.message}`);
  }
}

// Main script
const [,, url, masterPassword, ...rest] = process.argv;
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

(async () => {
  const finalUrl = url || await new Promise(resolve => readline.question("Enter API URL (e.g., https://your-app.pages.dev): ", resolve));
  const finalPassword = masterPassword || await new Promise(resolve => readline.question("Enter master password: ", resolve));
  const action = await new Promise(resolve => readline.question("Choose action (1 = Post Secret, 2 = Retrieve Secret): ", resolve));

  if (action === "1") {
    const secret = rest[0] || await new Promise(resolve => readline.question("Enter secret: ", resolve));
    await postSecret(finalUrl, finalPassword, secret);
  } else if (action === "2") {
    const code = rest[0] || await new Promise(resolve => readline.question("Enter secret code: ", resolve));
    const otp = rest[1] || await new Promise(resolve => readline.question("Enter OTP: ", resolve));
    await retrieveSecret(finalUrl, finalPassword, code, otp);
  } else {
    console.log("Invalid action. Use 1 or 2.");
  }
  readline.close();
})();