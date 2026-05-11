/**
 * Vercel serverless function — validates the site password.
 *
 * Used by the password modals on `/` and `/probation`. The LLM endpoint
 * does not enforce this password — only the site gate does.
 *
 * Required env vars (set in Vercel dashboard):
 *   SITE_PASSWORD — the shared password for the demo site
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

  return res.status(200).json({ ok: true });
}
