/**
 * Vercel serverless function — proxies LLM calls to Moonshot/Kimi (OpenAI-compatible).
 *
 * - Validates the password sent in the Authorization header
 * - Forwards the request to api.moonshot.ai using the server-side API key
 * - Returns the LLM response text
 *
 * Required env vars (set in Vercel dashboard):
 *   LLM_KEY        — your Moonshot/Kimi API key
 *   SITE_PASSWORD  — the shared password for the demo site
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

  if (!process.env.LLM_KEY) {
    return res.status(500).json({ error: 'Server missing LLM_KEY' });
  }

  const { prompt, model = 'kimi-k2-turbo-preview', max_tokens = 2048 } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  try {
    const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LLM_KEY}`,
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
    return res.status(200).json({ text: data.choices[0].message.content });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
