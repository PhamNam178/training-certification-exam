// Vercel Edge Function - Proxy to Salesforce REST API
export const config = { runtime: 'edge' };

export default async function handler(req) {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  // Extract path: /api/sf/v1/platform/certifications → v1/platform/certifications
  const url = new URL(req.url);
  const sfPath = url.pathname.replace('/api/sf/', '');
  const queryString = url.search || '';

  const sfUrl = `${process.env.SF_INSTANCE_URL}/services/apexrest/${sfPath}${queryString}`;

  try {
    const sfRes = await fetch(sfUrl, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${process.env.SF_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      ...(req.method === 'POST' ? { body: await req.text() } : {})
    });

    const data = await sfRes.text();
    return new Response(data, {
      status: sfRes.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
