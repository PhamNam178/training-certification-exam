// Vercel Serverless Function - Proxy to Salesforce REST API
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { endpoint } = req.query;
  const sfPath = Array.isArray(endpoint) ? endpoint.join('/') : endpoint;
  const queryString = req.url.includes('?') 
    ? '&' + req.url.split('?').slice(1).join('?').replace(/endpoint=[^&]*&?/, '')
    : '';
  
  const sfUrl = `${process.env.SF_INSTANCE_URL}/services/apexrest/v1/platform/${sfPath}${queryString ? '?' + queryString : ''}`;

  try {
    const sfRes = await fetch(sfUrl, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${process.env.SF_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      ...(req.method === 'POST' ? { body: JSON.stringify(req.body) } : {})
    });
    
    const data = await sfRes.json();
    res.status(sfRes.status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
