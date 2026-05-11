# CoE Testing — Prototype Gallery

> **No PII.** All data in every prototype is entirely fictional — made-up names, dates, and commentary. No real employee records, customer data, or personally identifiable information is used anywhere in this repository or in any API call made from it.

Static + serverless host for AI prototypes built by the Centre of Excellence.

- Frontend: plain HTML/CSS/JS pages, one folder per prototype
- Backend: a single Vercel serverless function (`api/llm.js`) that proxies all
  LLM calls to Moonshot/Kimi (OpenAI-compatible). The API key never leaves the server.
- Auth: a site-wide password held in a Vercel env var. Validated on every
  proxied request. Browsers store it in `sessionStorage` after the gate.

```
coe-prototypes/
├── api/
│   └── llm.js           — proxy to Moonshot/Kimi
├── probation/
│   └── index.html       — Probation Review Orchestrator
├── index.html           — landing page (lists all prototypes)
├── package.json
├── vercel.json
└── .gitignore
```

## Adding a new prototype

1. Create `<prototype-name>/index.html`.
2. Add a card linking to it on the landing page.
3. From the prototype JS, call `/api/llm` with `Authorization: Bearer <password>`. Reuse the password-gate pattern from `probation/index.html`.

## Deploying — first time

### 1. Push to GitHub
```bash
cd coe-prototypes
git init
git add .
git commit -m "Initial commit — CoE prototype gallery"
git branch -M main
git remote add origin git@github.com:<you>/coe-prototypes.git
git push -u origin main
```

### 2. Connect to Vercel
1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repo.
2. Framework preset: **Other** (no framework).
3. Leave build/output settings empty — Vercel detects the static files automatically.
4. Click **Deploy**.

### 3. Set environment variables
In the Vercel dashboard → Project → Settings → Environment Variables, add:

| Name | Value |
|---|---|
| `LLM_KEY` | Your Moonshot/Kimi API key (from platform.moonshot.ai) |
| `SITE_PASSWORD` | A password of your choice — share with people you want to give access |

After saving, redeploy (Deployments → latest → ⋯ → Redeploy) so the function picks up the env vars.

## Updating

Push to `main` → Vercel auto-deploys. Usually live within ~30 seconds.

## Rotating the password
Change `SITE_PASSWORD` in Vercel and redeploy. Anyone with the old password is locked out on their next API call.

## Rotating the API key
Generate a new key at [platform.moonshot.ai](https://platform.moonshot.ai/), swap `LLM_KEY` in Vercel, redeploy. The frontend doesn't change.

## Local development

You can preview the static pages just by opening `index.html` in a browser, but `/api/llm` won't work locally without `vercel dev`:

```bash
npm install -g vercel
vercel dev
```

Then visit `http://localhost:3000`. Set local env vars in `.env` (NOT `.env.local` — `vercel dev` on a linked project ignores `.env.local` and only reads `.env`). Both files are gitignored.

## Security notes

- The password is shared and only protects against casual access. Don't put anything sensitive behind it.
- A determined recipient can read the password out of `sessionStorage`. That's expected — the goal is "internal demo access", not "secure portal".
- The LLM key is server-side and never sent to the browser, so even if the password leaks, the key isn't exposed.
- All Workday data in these prototypes is mock/fixture data. No real customer data should ever be hardcoded into a prototype.
