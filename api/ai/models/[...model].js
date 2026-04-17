// Vercel Edge Function - Proxy to Google Gemini AI (True Streaming)
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const url = new URL(req.url);
  // /api/ai/models/gemini-flash-latest:streamGenerateContent?alt=sse
  // → models/gemini-flash-latest:streamGenerateContent?alt=sse
  const geminiPath = url.pathname.replace('/api/ai/', '');
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/${geminiPath}${url.search}`;

  try {
    const body = await req.json();

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': process.env.GEMINI_API_KEY
      },
      body: JSON.stringify(body)
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return new Response(errText, {
        status: geminiRes.status,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Stream trực tiếp từ Gemini → Client
    return new Response(geminiRes.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
