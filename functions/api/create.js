export async function onRequestPost({ request, env }) {
    const { encrypted, iv, expiry, maxAttempts, isE2EE } = await request.json();
  
    const code = crypto.randomUUID().slice(0, 6);
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
  
    const sessionKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const ivSession = crypto.getRandomValues(new Uint8Array(12));
    const encryptedServer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: ivSession },
      sessionKey,
      new TextEncoder().encode(encrypted)
    );
  
    const masterKeyRaw = env.MASTER_SERVER_KEY;
    const masterKey = await crypto.subtle.importKey(
      "raw",
      Uint8Array.from(atob(masterKeyRaw), c => c.charCodeAt(0)),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
    const ivMaster = crypto.getRandomValues(new Uint8Array(12));
    const sessionKeyRaw = await crypto.subtle.exportKey("raw", sessionKey);
    const encryptedSessionKey = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: ivMaster },
      masterKey,
      sessionKeyRaw
    );
  
    const secretData = {
      encrypted: btoa(String.fromCharCode(...new Uint8Array(encryptedServer))),
      ivClient: iv,
      ivSession: btoa(String.fromCharCode(...ivSession)),
      encryptedSessionKey: btoa(String.fromCharCode(...new Uint8Array(encryptedSessionKey))),
      ivMaster: btoa(String.fromCharCode(...ivMaster)),
      otp,
      expiry: Date.now() + parseInt(expiry) * 1000,
      maxAttempts: Math.min(Math.max(parseInt(maxAttempts), 1), 10),
      attemptsLeft: Math.min(Math.max(parseInt(maxAttempts), 1), 10),
      isE2EE: isE2EE || false,
    };
  
    await env.SECRETS_KV.put(code, JSON.stringify(secretData));
    return new Response(JSON.stringify({ success: true, code, otp }), { status: 200 });
  }