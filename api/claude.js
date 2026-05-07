/**
 * Vercel serverless function — proxies Claude API calls.
 *
 * - Validates the password sent in the Authorization header
 * - Forwards the request to api.anthropic.com using the server-side API key
 * - Returns the LLM response text
 *
 * Required env vars (set in Vercel dashboard):
 *   ANTHROPIC_API_KEY — your sk-ant-... key
 *   SITE_PASSWORD     — the shared password for the demo site
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = req.headers.authorization || '';
  const expected = `Bearer ${process.env.SITE_PASSWORD}`;
  if (!process.env.SITE_PASSWORD || auth !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY' });
  }

  const { prompt, model = 'claude-sonnet-4-6', max_tokens = 2048 } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    return res.status(200).json({ text: data.content[0].text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
