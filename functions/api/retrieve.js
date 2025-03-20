export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const otp = url.searchParams.get("otp");
  
    const secretData = await env.SECRETS_KV.get(code);
    if (!secretData) {
      return new Response(JSON.stringify({ success: false, message: "Secret not found or expired" }), { status: 404 });
    }
  
    const data = JSON.parse(secretData);
    if (Date.now() > data.expiry) {
      await env.SECRETS_KV.delete(code);
      return new Response(JSON.stringify({ success: false, message: "Secret expired" }), { status: 410 });
    }
  
    if (data.otp !== otp) {
      data.attemptsLeft--;
      if (data.attemptsLeft <= 0) {
        await env.SECRETS_KV.delete(code);
        return new Response(JSON.stringify({ success: false, message: "Max attempts exceeded" }), { status: 403 });
      }
      await env.SECRETS_KV.put(code, JSON.stringify(data));
      return new Response(JSON.stringify({ success: false, message: "Invalid OTP", attemptsLeft: data.attemptsLeft }), { status: 401 });
    }
  
    const masterKeyRaw = env.MASTER_SERVER_KEY;
    const masterKey = await crypto.subtle.importKey(
      "raw",
      Uint8Array.from(atob(masterKeyRaw), c => c.charCodeAt(0)),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
    const decryptedSessionKeyRaw = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: Uint8Array.from(atob(data.ivMaster), c => c.charCodeAt(0)) },
      masterKey,
      Uint8Array.from(atob(data.encryptedSessionKey), c => c.charCodeAt(0))
    );
    const sessionKey = await crypto.subtle.importKey(
      "raw",
      decryptedSessionKeyRaw,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    const decryptedServer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: Uint8Array.from(atob(data.ivSession), c => c.charCodeAt(0)) },
      sessionKey,
      Uint8Array.from(atob(data.encrypted), c => c.charCodeAt(0))
    );
  
    data.attemptsLeft--;
    if (data.attemptsLeft <= 0) await env.SECRETS_KV.delete(code);
    else await env.SECRETS_KV.put(code, JSON.stringify(data));
  
    return new Response(JSON.stringify({
      success: true,
      encrypted: new TextDecoder().decode(decryptedServer),
      iv: data.ivClient,
      attemptsLeft: data.attemptsLeft,
      isE2EE: data.isE2EE,
      expiry: data.expiry, // Add expiry timestamp to response
    }), { status: 200 });
  }