export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
  
    if (!code) {
      return new Response(JSON.stringify({ success: false, message: "Secret code is required" }), { status: 400 });
    }
  
    const secretData = await env.SECRETS_KV.get(code);
    if (!secretData) {
      return new Response(JSON.stringify({ success: false, message: "Secret not found or expired" }), { status: 404 });
    }
  
    const data = JSON.parse(secretData);
    if (Date.now() > data.expiry) {
      await env.SECRETS_KV.delete(code);
      return new Response(JSON.stringify({ success: false, message: "Secret expired" }), { status: 410 });
    }
  
    return new Response(JSON.stringify({ success: true, message: "Secret exists" }), { status: 200 });
  }