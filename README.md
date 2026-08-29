# CreatorOS

> **The financial operating system for content creators.** Track income from every platform, manage brand deals through a Kanban CRM, generate GST-compliant invoices, discover sponsorship opportunities, and collaborate with creators in your niche — all in one premium dashboard.

[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Tailwind](https://img.shields.io/badge/Tailwind-3-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

---

## ✨ Features

| Module                      | What it does                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------ |
| **Dashboard**               | Monthly revenue, paid/active deals, payment reminders, cashflow timeline, milestones |
| **Income Tracker**          | Multi-platform income logging with source & date filters                             |
| **Brand Deal CRM**          | 6-stage Kanban pipeline (lead → negotiating → confirmed → delivered → pending → paid)|
| **AI Brand Deal Finder** 🆕 | Niche-matched sponsorship discovery + AI pitch generator + outreach pipeline         |
| **Creator Network** 🆕      | Compatibility scoring, fake-follower detection, collab ROI estimation                |
| **GST Invoice Generator**   | CGST/SGST/IGST-compliant invoices with PDF export                                    |
| **Analytics**               | Revenue trends, platform breakdown, content performance                              |
| **AI Pricing**              | Gemini-powered deal price suggestions based on your audience metrics                 |

---

## 🏗️ Tech stack

- **Frontend** — React 19, Tailwind CSS, Shadcn/UI, Framer Motion, Recharts, jsPDF
- **Backend** — FastAPI, Motor (async MongoDB driver), Pydantic v2
- **Database** — MongoDB (Atlas-ready)
- **Auth** — Cookie-based sessions with OAuth bridge
- **AI** — Google Gemini 3 Flash via Emergent LLM bridge

---

## 📁 Project structure

```
.
├── backend/
│   ├── server.py              # FastAPI bootstrap (CORS, router mount)
│   ├── database.py            # Async MongoDB client
│   ├── deps.py                # Shared FastAPI dependencies (auth)
│   ├── models/                # Pydantic models per domain
│   │   ├── user.py
│   │   ├── deal.py
│   │   ├── income.py
│   │   ├── content.py
│   │   ├── invoice.py
│   │   └── pricing.py
│   ├── routes/                # One router per resource
│   │   ├── auth.py
│   │   ├── profile.py
│   │   ├── income.py
│   │   ├── deals.py
│   │   ├── content.py
│   │   ├── invoices.py
│   │   ├── dashboard.py
│   │   └── ai.py
│   ├── services/
│   │   └── pricing_service.py # AI pricing logic + heuristic fallback
│   ├── tests/                 # Pytest regression suite
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── pages/             # Top-level route components
│   │   ├── components/        # Reusable UI + shadcn primitives
│   │   ├── context/           # Auth + theme providers
│   │   └── data/              # Mock data for Brand Finder & Network
│   ├── package.json
│   └── .env.example
├── netlify.toml               # Netlify build + SPA redirect config
├── render.yaml                # Render.com blueprint for the backend
├── DEPLOYMENT.md              # Full deployment walkthrough
└── README.md
```

---

## 🚀 Quick start (local)

### Prerequisites

- Node ≥ 18, Yarn 1.22+
- Python ≥ 3.11
- MongoDB running locally **or** a free Atlas cluster

### 1 — Clone & install

```bash
git clone https://github.com/<your-username>/creatoros.git
cd creatoros

# backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # then edit MONGO_URL / DB_NAME / CORS_ORIGINS

# frontend
cd ../frontend
yarn install
cp .env.example .env       # then set REACT_APP_BACKEND_URL=http://localhost:8001
```

### 2 — Run

```bash
# terminal 1 — API
cd backend
uvicorn server:app --reload --port 8001

# terminal 2 — UI
cd frontend
yarn start
```

Open http://localhost:3000. Use access code **`FIRST100`** to unlock the paywall.

---

## ☁️ Deploy to production

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full walkthrough.

**TL;DR**

| Layer    | Host             | Config file    |
| -------- | ---------------- | -------------- |
| Frontend | Netlify          | `netlify.toml` |
| Backend  | Render.com       | `render.yaml`  |
| Database | MongoDB Atlas    | (no file)      |

---

## 🧪 Tests

```bash
cd backend
pytest tests/ -v
```

Covers every endpoint listed under [Features](#-features). The full regression suite (30 tests) passes against a clean MongoDB instance in under 10 seconds.

---

## 🔑 Environment variables

### Backend (`backend/.env`)

| Key                  | Required | Description                                                                   |
| -------------------- | -------- | ----------------------------------------------------------------------------- |
| `MONGO_URL`          | ✅       | MongoDB connection string                                                     |
| `DB_NAME`            | ✅       | Database name (e.g. `creatoros`)                                              |
| `CORS_ORIGINS`       | ✅       | Comma-separated allowed origins                                               |
| `EMERGENT_LLM_KEY`   | ⚪       | For AI pricing — falls back to a heuristic if absent                          |

### Frontend (`frontend/.env`)

| Key                     | Required | Description                                  |
| ----------------------- | -------- | -------------------------------------------- |
| `REACT_APP_BACKEND_URL` | ✅       | Full URL of the deployed backend (no slash)  |

---

## 📜 License

MIT © CreatorOS contributors.
