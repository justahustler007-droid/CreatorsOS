# CreatorOS — Production Deployment Guide

Complete walkthrough to ship CreatorOS to production using **GitHub + Netlify (frontend) + Render (backend) + MongoDB Atlas (database)**. All services have free tiers.

---

## 1. Architecture

```
┌──────────────────┐      HTTPS       ┌─────────────────────┐      mongodb+srv      ┌──────────────┐
│  Netlify CDN     │  ───────────────▶│  Render web service │  ────────────────────▶│  Atlas (M0)  │
│  React SPA       │                  │  FastAPI + Uvicorn  │                       │  MongoDB     │
└──────────────────┘                  └─────────────────────┘                       └──────────────┘
```

The frontend talks to the backend through the public env var `REACT_APP_BACKEND_URL`.

---

## 2. Prerequisites

| Account          | Purpose                              | Cost     |
| ---------------- | ------------------------------------ | -------- |
| GitHub           | Source-of-truth repository           | Free     |
| MongoDB Atlas    | Managed database (M0 cluster)        | Free     |
| Render.com       | Backend hosting (auto-build on push) | Free     |
| Netlify          | Frontend hosting + CDN               | Free     |
| Google Cloud     | OAuth credentials *(optional)*       | Free     |

---

## 3. Push the code to GitHub

```bash
cd /app
git init
git add .
git commit -m "feat: CreatorOS initial production-ready release"
git branch -M main
git remote add origin git@github.com:<your-username>/creatoros.git
git push -u origin main
```

> ⚠️ Confirm `.env` is **never** committed. The `.gitignore` at the repo root already excludes it.

---

## 4. Provision MongoDB Atlas

1. Sign up at https://www.mongodb.com/cloud/atlas
2. Create a free **M0** shared cluster (any region near your users).
3. **Database Access** → add user with read/write to any database. Save the password.
4. **Network Access** → add `0.0.0.0/0` (or restrict to Render's egress IPs once known).
5. **Connect** → "Drivers" → copy the connection string:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

---

## 5. Deploy the backend on Render

The repo already includes `render.yaml`.

1. Render dashboard → **New +** → **Blueprint** → connect your GitHub repo.
2. Render reads `render.yaml` automatically. Confirm the `creatoros-api` service.
3. Set the secret env vars when prompted:

   | Variable           | Value                                                                          |
   | ------------------ | ------------------------------------------------------------------------------ |
   | `MONGO_URL`        | `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority` |
   | `DB_NAME`          | `creatoros`                                                                    |
   | `CORS_ORIGINS`     | `https://<your-site>.netlify.app` (add comma-separated previews if needed)     |
   | `EMERGENT_LLM_KEY` | *(optional — only for AI pricing suggestions)*                                 |

4. Click **Deploy**. After build, you get a URL like `https://creatoros-api.onrender.com`.
5. Verify: `curl https://creatoros-api.onrender.com/api/health` → `{"status":"healthy"}`.

> 💡 Render's free plan idles after 15 min of inactivity. Cold starts take ~30 s. Upgrade to **Starter ($7/mo)** for always-on.

---

## 6. Deploy the frontend on Netlify

1. Netlify dashboard → **Add new site** → **Import from Git** → connect your repo.
2. Netlify auto-detects `netlify.toml`. Confirm:
   - **Base directory:** `frontend`
   - **Build command:** `yarn install --frozen-lockfile && yarn build`
   - **Publish directory:** `frontend/build`
3. **Environment variables** → add:

   | Variable                | Value                                |
   | ----------------------- | ------------------------------------ |
   | `REACT_APP_BACKEND_URL` | `https://creatoros-api.onrender.com` |

4. **Deploy site**. After build (~3 min), open the Netlify URL.
5. Custom domain: **Domain settings** → **Add custom domain** → follow DNS instructions.

---

## 7. Wire up authentication (Google OAuth)

CreatorOS uses an OAuth bridge in `backend/routes/auth.py` (`/api/auth/session` exchanges a `session_id` for a session cookie). The default integration points at the Emergent OAuth gateway.

To run **your own** Google OAuth:

1. Create OAuth credentials in https://console.cloud.google.com/apis/credentials
2. Authorized redirect URI: `https://<your-frontend>.netlify.app/auth/callback`
3. Replace the gateway URL in `backend/routes/auth.py` with your own token-exchange endpoint (Auth0, Clerk, Supabase, Firebase Auth, or a custom OAuth handler).

---

## 8. Post-deploy checklist

- [ ] `https://<frontend>.netlify.app` loads the landing page
- [ ] Sign-in flow lands on `/dashboard`
- [ ] Early-access code `FIRST100` grants access
- [ ] CRUD on income / deals / invoices persists in Atlas
- [ ] `/brand-finder` and `/network` render with full animations
- [ ] PDF invoice download works in the browser
- [ ] AI pricing endpoint returns a price range *(only if `EMERGENT_LLM_KEY` is set)*
- [ ] Render logs show no 500s after 24 h of usage

---

## 9. Common pitfalls

| Symptom                                       | Fix                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `CORS error` in browser console               | Add the Netlify URL to `CORS_ORIGINS` in Render env vars, then redeploy.             |
| Login succeeds but `/api/auth/me` returns 401 | `session_token` cookie blocked. Confirm both frontend & backend are on HTTPS.        |
| Build fails on Netlify with `CI=true` errors  | Already set `CI=false` in `netlify.toml`. Ensure the file is committed.              |
| Render service spins down constantly          | Upgrade to Starter, or hit `/api/health` from a free uptime monitor like UptimeRobot.|
| MongoDB `Authentication failed`               | Re-copy the password — Atlas regenerates it if you reset the user.                   |

---

## 10. Optional — alternative backend hosts

| Provider          | Notes                                                                  |
| ----------------- | ---------------------------------------------------------------------- |
| **Railway**       | `railway init` from `backend/` → uses the included `Dockerfile`.       |
| **Fly.io**        | `fly launch` from `backend/` → autodetects Dockerfile.                 |
| **Google Cloud Run** | `gcloud run deploy --source backend/` → fully managed, scales to zero. |

All three read the same env vars listed in section 5.
