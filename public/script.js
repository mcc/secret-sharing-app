// Utility to generate QR code using qrcode-generator
function generateQRCode(url) {
    const qr = qrcode(0, 'L'); // Type 0 (auto), Error correction level L
    qr.addData(url);
    qr.make();
    document.getElementById("qrCode").innerHTML = qr.createSvgTag(4); // Scale factor 4
  }
  
  // Client-side encryption/decryption using Web Crypto API
  async function encryptSecret(secret, password) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: enc.encode("salt"), iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(secret)
    );
    return { iv: btoa(String.fromCharCode(...iv)), data: btoa(String.fromCharCode(...new Uint8Array(encrypted))) };
  }
  
  async function decryptSecret(encrypted, iv, password) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: enc.encode("salt"), iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["decrypt"]
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: Uint8Array.from(atob(iv), c => c.charCodeAt(0)) },
      key,
      Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))
    );
    return new TextDecoder().decode(decrypted);
  }
  
  // Generate a 4-character offline key
  function generateOfflineKey() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let key = "";
    for (let i = 0; i < 4; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  }
  
  // Show alert box
  function showAlert(message) {
    const alertBox = document.getElementById("alertBox");
    const alertMessage = document.getElementById("alertMessage");
    alertMessage.textContent = message;
    alertBox.classList.remove("hidden");
  }
  
  // Hide alert box
  document.getElementById("closeAlert")?.addEventListener("click", () => {
    document.getElementById("alertBox").classList.add("hidden");
  });
  
  // Toggle password field enabled state
  document.getElementById("enableE2EE")?.addEventListener("change", (e) => {
    const passwordInput = document.getElementById("password");
    passwordInput.disabled = !e.target.checked;
    passwordInput.required = e.target.checked;
  });
  
  // Toggle secret masking
  document.getElementById("toggleMask")?.addEventListener("click", () => {
    const secretInput = document.getElementById("secret");
    const isMasked = secretInput.type === "password";
    secretInput.type = isMasked ? "text" : "password";
    document.getElementById("toggleMask").innerHTML = isMasked
      ? '<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>'
      : '<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>';
  });
  
  // Handle secret creation
  document.getElementById("secretForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const secret = document.getElementById("secret").value;
    const enableE2EE = document.getElementById("enableE2EE").checked;
    const password = document.getElementById("password").value;
    const expiry = document.getElementById("expiry").value;
    const maxAttempts = document.getElementById("maxAttempts").value;
  
    let encryptedData = { data: secret, iv: null };
    let offlineKey = null;
    let link;
  
    if (enableE2EE) {
      if (!password) {
        showAlert("Please enter an encryption password.");
        return;
      }
      encryptedData = await encryptSecret(secret, password);
      link = `${window.location.origin}/retrieve.html?code=${encryptedData.code}`;
    } else {
      offlineKey = generateOfflineKey();
      encryptedData = await encryptSecret(secret, offlineKey);
      link = `${window.location.origin}/retrieve.html?code=${encryptedData.code}&key=${offlineKey}`;
    }
  
    const response = await fetch("/api/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        encrypted: encryptedData.data,
        iv: encryptedData.iv,
        expiry,
        maxAttempts,
        isE2EE: enableE2EE || false,
      }),
    });
    const data = await response.json();
  
    if (data.success) {
      const result = document.getElementById("result");
      const form = document.getElementById("secretForm");
      link = enableE2EE ? `${window.location.origin}/retrieve.html?code=${data.code}` : `${window.location.origin}/retrieve.html?code=${data.code}&key=${offlineKey}`;
      document.getElementById("secret").value = ""; // Clear secret field
      document.getElementById("secretLink").href = link;
      document.getElementById("secretLink").textContent = link;
      document.getElementById("otp").textContent = data.otp;
      form.classList.add("hidden");
      result.classList.remove("hidden");
      generateQRCode(link);
  
      document.getElementById("copyBtn").onclick = () => {
        navigator.clipboard.writeText(link);
        showAlert("Link copied to clipboard!");
      };
    } else {
      showAlert("Error creating secret: " + data.message);
    }
  });
  
  // Update expiry timer
  function updateExpiryTimer(expiry) {
    const timer = document.getElementById("expiryTimer");
    if (!timer) return;
  
    const interval = setInterval(() => {
      const now = Date.now();
      const timeLeft = expiry - now;
      if (timeLeft <= 0) {
        timer.textContent = "Secret expired";
        clearInterval(interval);
      } else {
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        timer.textContent = `Expires in: ${minutes}m ${seconds}s`;
      }
    }, 1000);
  }
  
  // Check secret code existence on page load
  async function checkSecretCode(code) {
    const statusMessage = document.getElementById("statusMessage");
    if (!code) {
      statusMessage.textContent = "Please enter a secret code.";
      statusMessage.classList.remove("hidden");
      return;
    }
  
    const response = await fetch(`/api/check?code=${code}`);
    const data = await response.json();
  
    statusMessage.classList.remove("hidden");
    if (data.success) {
      statusMessage.textContent = "Ready to retrieve your secret.";
      statusMessage.classList.remove("text-red-400");
      statusMessage.classList.add("text-green-400");
    } else {
      statusMessage.textContent = data.message;
      statusMessage.classList.remove("text-green-400");
      statusMessage.classList.add("text-red-400");
    }
  }
  
  // Handle OTP verification and conditional password prompt
  let retrievedData = null;
  document.getElementById("otpForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = document.getElementById("code").value;
    const otp = document.getElementById("otp").value;
    const urlParams = new URLSearchParams(window.location.search);
    const offlineKey = urlParams.get("key");
  
    const response = await fetch(`/api/retrieve?code=${code}&otp=${otp}`);
    retrievedData = await response.json();
  
    if (retrievedData.success) {
      document.getElementById("attemptsLeft").textContent = `Attempts remaining: ${retrievedData.attemptsLeft}`;
      updateExpiryTimer(retrievedData.expiry);
      if (retrievedData.attemptsLeft > 0) {
        document.getElementById("removeBtn").classList.remove("hidden");
        document.getElementById("secretRemoved").classList.add("hidden");
        document.getElementById("secretRemovedDesc").classList.add("hidden");
      } else {
        document.getElementById("removeBtn").classList.add("hidden");
        document.getElementById("secretRemoved").classList.remove("hidden");
        document.getElementById("secretRemovedDesc").classList.remove("hidden");
      }
      if (retrievedData.isE2EE) {
        document.getElementById("passwordSection").classList.remove("hidden");
        document.getElementById("otpForm").classList.add("hidden");
      } else if (offlineKey) {
        const decrypted = await decryptSecret(retrievedData.encrypted, retrievedData.iv, offlineKey);
        document.getElementById("secretOutput").value = decrypted;
        document.getElementById("result").classList.remove("hidden");
        document.getElementById("otpForm").classList.add("hidden");
      } else {
        document.getElementById("secretOutput").value = retrievedData.encrypted;
        document.getElementById("result").classList.remove("hidden");
        document.getElementById("otpForm").classList.add("hidden");
      }
    } else {
      document.getElementById("attemptsLeft").textContent = `Attempts remaining: ${retrievedData.attemptsLeft || 0}`;
      showAlert("Error verifying OTP: " + retrievedData.message);
    }
  });
  
  // Handle decryption if E2EE is enabled
  document.getElementById("decryptBtn")?.addEventListener("click", async () => {
    const password = document.getElementById("password").value;
    if (!password) {
      showAlert("Please enter the decryption password.");
      return;
    }
  
    try {
      const decrypted = await decryptSecret(retrievedData.encrypted, retrievedData.iv, password);
      document.getElementById("secretOutput").value = decrypted;
      document.getElementById("result").classList.remove("hidden");
      document.getElementById("passwordSection").classList.add("hidden");
      if (retrievedData.attemptsLeft > 0) {
        document.getElementById("removeBtn").classList.remove("hidden");
        document.getElementById("secretRemoved").classList.add("hidden");
        document.getElementById("secretRemovedDesc").classList.add("hidden");
      } else {
        document.getElementById("removeBtn").classList.add("hidden");
        document.getElementById("secretRemoved").classList.remove("hidden");
        document.getElementById("secretRemovedDesc").classList.remove("hidden");
      }
    } catch (error) {
      showAlert("Decryption failed: Incorrect password or corrupted data.");
    }
  });
  
  // Handle secret removal
  document.getElementById("removeBtn")?.addEventListener("click", async () => {
    const code = document.getElementById("code").value;
    const response = await fetch(`/api/remove?code=${code}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (data.success) {
      showAlert("Secret removed successfully.");
      document.getElementById("result").classList.add("hidden");
      document.getElementById("otpForm").classList.remove("hidden");
      document.getElementById("secretOutput").value = "";
      document.getElementById("removeBtn").classList.add("hidden");
      document.getElementById("secretRemoved").classList.remove("hidden");
      document.getElementById("secretRemovedDesc").classList.remove("hidden");
    } else {
      showAlert("Error removing secret: " + data.message);
    }
  });
  
  // Pre-fill code from URL, make read-only if present, and check existence
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  if (code) {
    const codeInput = document.getElementById("code");
    codeInput.value = code;
    codeInput.readOnly = true;
    codeInput.classList.add("bg-gray-600", "cursor-not-allowed");
    checkSecretCode(code);
  } else {
    checkSecretCode(""); // Show message if no code is provided
  }