export async function onRequestDelete({ request, env }) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
  
    const secretData = await env.SECRETS_KV.get(code);
    if (!secretData) {
      return new Response(JSON.stringify({ success: false, message: "Secret not found" }), { status: 404 });
    }
  
    await env.SECRETS_KV.delete(code);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }