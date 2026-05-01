<div align="center">

# 🔬 ResearchFlow

### *Turn any research question into a cited academic report — in under 2 minutes.*


<br/>

**ResearchFlow** is an autonomous academic research assistant. Ask it any complex question —
it deconstructs your query, searches **Semantic Scholar**, **arXiv**, **PubMed**, and **OpenAlex** simultaneously,
filters thousands of papers for relevance, and synthesises a structured, fully-cited report. All in one click.

<br/>

[🌐 Live Demo](#-live-demo) · [✨ Features](#-features) · [⚙️ How It Works](#-how-it-works) · [🚀 Getting Started](#-getting-started) · [🗺️ Roadmap](#-roadmap)

---

</div>

## 📋 Table of Contents

- [Overview](#-overview)
- [Live Demo](#-live-demo)
- [Features](#-features)
- [How It Works](#-how-it-works)
- [Project Structure](#-project-structure)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Database Schema](#-database-schema)
- [Backend API Reference](#-backend-api-reference)
- [Authentication Flow](#-authentication-flow)
- [Deployment](#-deployment)
- [Configuration Reference](#-configuration-reference)
- [Known Limitations](#-known-limitations)
- [Roadmap](#-roadmap)
- [Author](#-author)

---

## 🔭 Overview

ResearchFlow removes the most painful part of academic research — the hours spent searching databases, skimming abstracts, and stitching together a coherent picture of a field.

You type **one question**. ResearchFlow's AI pipeline handles everything else:

| Stage | What happens |
|---|---|
| 🧠 **Plan** | LLM deconstructs your query into orthogonal research dimensions |
| 🔍 **Execute** | 4 academic databases searched in parallel |
| 🔁 **Dedup** | Duplicate papers removed and results ranked |
| 📄 **Enrich** | Open-access PDFs fetched via Unpaywall |
| ✂️ **Filter** | Semantic + lexical relevance scoring removes noise |
| ✍️ **Synthesise** | LLM writes a structured, cited markdown report |

The result reads like a researcher spent 6 hours on it. Delivered in under 2 minutes.

> This repository is the **frontend only**. The backend (FastAPI + Redis + LLM pipeline) is deployed separately on Railway.

---

## 🌐 Live Demo

> 🚀 **[researchflow.vercel.app](https://researchflow.vercel.app)** *(update after deployment)*

**Try these queries to see ResearchFlow at its best:**

```
Neuro-symbolic AI in medical diagnosis
Graph neural networks for drug discovery and protein interaction
Federated learning privacy preservation in distributed healthcare
Large language model fine-tuning techniques for low-resource NLP
```

---

## ✨ Features

<details>
<summary><b>🔍 Research Engine</b></summary>

- **Job-queue architecture** — submit a query, receive a `job_id`, poll for completion; the UI never blocks
- **4-step animated progress tracker** — real-time step indicators during the pipeline run
- **Markdown report rendering** — full heading, list, table, code, and link support via `marked.js`
- **Reference table** — all cited papers rendered as a sortable table with title, authors, year, and "View Paper ↗" links
- **Guest mode** — complete search functionality without creating an account

</details>

<details>
<summary><b>👤 Authentication</b></summary>

- **Sign Up / Log In** — email + password authentication via Supabase Auth
- **Email verification** — custom "Check your inbox" modal with the user's email shown
- **Session persistence** — stays logged in across page reloads and browser restarts
- **Password visibility toggle** — SVG eye icon toggles password visibility
- **Real-time auth sync** — login or logout in any tab instantly updates the UI everywhere
- **Auto-profile creation** — database trigger creates a `profiles` row the moment a user signs up

</details>

<details>
<summary><b>📚 Research History</b></summary>

- **Auto-save** — every successful search is saved to Supabase for logged-in users
- **Sidebar history** — last 20 searches shown as clickable items
- **Instant reload** — clicking a history item loads the saved report from the database, never re-runs the pipeline
- **Delete entries** — hover over any history item to reveal an × button; click to delete permanently

</details>

<details>
<summary><b>🎨 UI & Experience</b></summary>

- **Elegant design** — Playfair Display + DM Sans, warm espresso colour palette
- **Scroll animations** — elements animate in on scroll and reset on scroll out (Intersection Observer)
- **Pipeline visualiser** — animated diagram on the landing page showing how the pipeline works
- **Typewriter hero** — cycling researcher-pain-point phrases in the hero section
- **Fortune Cookie widget** — interactive break widget with cynical researcher humour
- **Hello, [Name] greeting** — personalised sidebar greeting for logged-in users

</details>

---

## ⚙️ How It Works

### Frontend Request Lifecycle

```
User types query → clicks "Research"
        │
        ▼
POST /research  ──────────────────────►  FastAPI (Railway)
{ query: "..." }                               │
        │                                      │ Creates job in Redis
        ◄── { job_id: "uuid..." } ─────────────┘
        │
        │   Poll every 3 seconds
        ├──► GET /research/{job_id} ──► { status: "running" }
        ├──► GET /research/{job_id} ──► { status: "running" }
        └──► GET /research/{job_id} ──► { status: "done", report: "..." }
                                                │
        ◄── Markdown report ───────────────────┘
        │
        ├── Render with marked.js
        ├── Format references as table
        └── Save to Supabase (if logged in)
```

### Backend Pipeline (on Railway)

```
Query
  │
  ▼
[PLAN] LLM splits query into 4 orthogonal angles
  │    e.g. "Mechanism", "Clinical Evidence", "Safety", "Implementation"
  │
  ▼
[EXECUTE] Parallel searches across:
  │    ├── Semantic Scholar  (200M+ papers, all domains)
  │    ├── arXiv             (CS/ML/AI preprints)
  │    ├── PubMed            (biomedical literature)
  │    └── OpenAlex          (cross-domain, 250M+ works)
  │
  ▼
[DEDUP] Remove duplicates, rank by citation count
  │
  ▼
[ENRICH] Fetch open-access PDFs via Unpaywall
  │
  ▼
[FILTER] Semantic + lexical relevance scoring
  │       Keeps ~20–25 most relevant papers
  │
  ▼
[SYNTHESISE] Groq LLM (LLaMA 3.3 70B) writes the report
  │
  ▼
{ status: "done", report: "## Introduction\n..." }
```

---

## 🗂️ Project Structure

```
researchFlow_frontend/
│
├── 📄 index.html                  # Landing page (hero, pipeline, how-it-works)
├── 📄 app.html                    # Workspace (search bar, results, auth modal)
│
├── 📁 css/
│   ├── main.css                   # Global tokens, typography, layout
│   └── cookie.css                 # Fortune cookie widget styles
│
├── 📁 js/
│   ├── auth.example.js            # ✅ Committed — credential template
│   ├── auth.js                    # ❌ Gitignored — Supabase client init
│   ├── app.js                     # Core: search, auth, history, rendering
│   ├── scroll.js                  # Scroll-triggered reveal animations
│   ├── pipeline.js                # Pipeline diagram animations
│   ├── typewriter.js              # Hero typewriter cycling effect
│   ├── search.js                  # Landing page CTA / search logic
│   └── cookie.js                  # Fortune cookie widget
│
├── 📁 assets/
│   ├── cookie.svg
│   ├── cookie-left.svg
│   └── cookie-right.svg
│
├── 📄 .gitignore                  # Excludes auth.js
├── 📄 supabase_schema.sql         # Run once in Supabase SQL Editor
└── 📄 README.md
```

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **UI** | Vanilla HTML + CSS + JS (ES2022) | No build step, fast load, full control |
| **Auth** | [Supabase Auth](https://supabase.com/auth) | Email/password, sessions, email verification |
| **Database** | [Supabase PostgreSQL](https://supabase.com) | User profiles + research history |
| **Markdown** | [marked.js](https://marked.js.org) | Render LLM report output |
| **Backend** | [FastAPI](https://fastapi.tiangolo.com) on [Railway](https://railway.app) | Research pipeline API |
| **Job Queue** | Redis | Background job state, TTL management |
| **LLM** | Groq LLaMA 3.3 70B + Gemini 2.0 Flash | Query planning + synthesis |
| **Sources** | Semantic Scholar, arXiv, PubMed, OpenAlex | 700M+ combined academic papers |
| **Fonts** | Playfair Display + DM Sans | Display + body typography pair |
| **Hosting** | [Vercel](https://vercel.com) | Frontend CDN + global edge |

---

## 🚀 Getting Started

### Prerequisites

- A [Supabase](https://supabase.com) project (free tier works)
- The ResearchFlow backend URL (Railway deployment)
- VS Code + [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension

### Step 1 — Clone

```bash
git clone https://github.com/sujalsuyash/ResearchFlow_Frontend.git
cd ResearchFlow_Frontend
```

### Step 2 — Create `auth.js`

```bash
cp js/auth.example.js js/auth.js
```

Open `js/auth.js` and fill in your Supabase credentials:

```js
const SUPABASE_URL  = "https://your-project-id.supabase.co";
const SUPABASE_ANON = "sb_publishable_your_key_here";

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
```

> **Where to find these:** Supabase Dashboard → Settings → API Keys
> - URL = Project URL
> - Key = Publishable key (safe for frontend use)

> ⚠️ `auth.js` is in `.gitignore` — it will **never** be committed.

### Step 3 — Set up the database

1. Go to **Supabase Dashboard → SQL Editor → New Query**
2. Paste the full contents of `supabase_schema.sql`
3. Click **Run**

This creates the `profiles` and `research_history` tables, RLS policies, and the auto-profile trigger.

### Step 4 — Configure redirect URLs

**Supabase → Authentication → URL Configuration:**

| Field | Value |
|---|---|
| Site URL | `http://127.0.0.1:5500` |
| Redirect URLs | `http://127.0.0.1:5500` |
| Redirect URLs | `http://127.0.0.1:5500/app.html` |

### Step 5 — Run

Open `index.html` with **Live Server** in VS Code → `http://127.0.0.1:5500`

---

## 🗄️ Database Schema

### `profiles` — User information

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | PK — mirrors `auth.users.id` |
| `full_name` | `text` | Name entered at signup |
| `email` | `text` | Email address |
| `created_at` | `timestamptz` | Sign-up timestamp |
| `last_sign_in` | `timestamptz` | Updated on every login |

### `research_history` — Saved searches

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Auto-generated PK |
| `user_id` | `uuid` | FK → `profiles.id` |
| `query` | `text` | The research question |
| `report` | `text` | Full markdown report |
| `paper_count` | `int` | Papers cited in report |
| `total_seconds` | `float` | Pipeline execution time |
| `created_at` | `timestamptz` | Search timestamp |

### Admin overview

Run in the Supabase SQL Editor to see all users + their activity:

```sql
SELECT * FROM admin_user_overview;
```

---

## 🔌 Backend API Reference

**Base URL:** `https://researchflow-production.up.railway.app`

### `POST /research`

Submit a research query. Returns immediately with a `job_id`.

```jsonc
// Request
{
  "query": "Neuro-symbolic AI in medical diagnosis",
  "max_papers": 40,          // optional, default 40
  "papers_per_step": 10,     // optional, default 10
  "tool_timeout": 120.0      // optional, default 120s
}

// Response — 202 Accepted
{
  "job_id": "7b8a2525-dca9-431b-86cf-3cdb615ade4f",
  "status": "pending",
  "message": "Job queued. Poll GET /research/{job_id} for updates."
}
```

### `GET /research/{job_id}`

Poll every 3 seconds. The pipeline takes 20–80s depending on server load.

```jsonc
// Status: running
{ "job_id": "...", "status": "running", "query": "..." }

// Status: done ✅
{
  "job_id": "7b8a2525-...",
  "status": "done",
  "query": "Neuro-symbolic AI in medical diagnosis",
  "report": "## Introduction\n\nNeuro-symbolic AI...",
  "paper_count": 23,
  "raw_paper_count": 45,
  "plan_steps": 4,
  "total_seconds": 76.0,
  "stage_timings": {
    "plan": 2.3,
    "execute": 7.9,
    "dedup": 0.2,
    "enrich": 3.4,
    "filter": 1.6,
    "synthesise": 5.8
  }
}

// Status: failed ❌
{ "job_id": "...", "status": "failed", "error": "ResilientLLM: all providers exhausted." }
```

| Status | Meaning |
|---|---|
| `pending` | Queued, not started |
| `running` | Pipeline executing |
| `done` | Report ready — use `report` field |
| `failed` | Error — see `error` field |

### `GET /health`

```json
{ "status": "ok", "redis": "connected" }
```

---

## 🔐 Authentication Flow

```
User fills Sign Up form (name, email, password)
              │
              ▼
    _supabase.auth.signUp(...)
              │
              ▼
    Supabase creates auth.users row
    (password bcrypt-hashed automatically)
              │
              ▼
    DB trigger fires → creates profiles row
    with full_name, email, created_at
              │
              ▼
    Confirmation email sent
    User clicks link → redirected to app.html
              │
              ▼
    onAuthStateChange fires
    → updateUIForUser() → loadHistory()
              │
              ▼
    Session stored in browser
    Persists across page reloads ✅
```

---

## 🌐 Deployment

### Deploy to Vercel (recommended)

```bash
# 1. Make sure auth.js is NOT in your repo
git status  # auth.js should NOT appear

# 2. Push latest code
git push origin main
```

Then:
1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import `ResearchFlow_Frontend` from GitHub
3. Framework: **Other** | Build command: *(empty)* | Output: *(empty)*
4. Click **Deploy**

After you get your production URL (e.g. `https://researchflow.vercel.app`), update:

| Location | What to change |
|---|---|
| Supabase → Auth → Site URL | `https://researchflow.vercel.app` |
| Supabase → Auth → Redirect URLs | `https://researchflow.vercel.app/app.html` |
| `app.js` → `emailRedirectTo` | `https://researchflow.vercel.app/app.html` |

---

## ⚙️ Configuration Reference

| Variable | File | Description |
|---|---|---|
| `SUPABASE_URL` | `js/auth.js` | Supabase project URL |
| `SUPABASE_ANON` | `js/auth.js` | Supabase publishable key |
| `API_BASE` | `js/app.js` | FastAPI backend base URL |
| `STEP_DELAYS` | `js/app.js` | Step animation timings in seconds `[0, 10, 22, 38]` |
| `MAX_POLLS` | `js/app.js` | Max polling attempts before timeout (default `60` = 3 min) |
| `emailRedirectTo` | `js/app.js` | URL Supabase redirects to after email confirmation |

---

## ⚠️ Known Limitations

| Issue | Cause | Workaround |
|---|---|---|
| "Researchers at capacity" error | Free-tier Groq/Gemini rate limits hit | Wait for daily reset or upgrade to paid API keys |
| Jobs expire after 1 hour | Redis TTL on job store | Reports saved to Supabase DB are permanent |
| No offline support | Requires live backend + Supabase | — |
| arXiv underrepresented on medical topics | LLM planner routes by domain appropriateness | Backend enforces arXiv inclusion for ML/CS queries |

---

## 🗺️ Roadmap

-  Autonomous 4-stage research pipeline
-  Supabase auth (signup, login, email verification, session persistence)
-  Research history (save, load, delete)
-  Reference table with direct paper links
-  Scroll animations (reset on scroll out)
-  Vercel deployment
-  Google OAuth ("Continue with Google")
-  Export report as PDF
-  Search within history
-  Share report via public link
-  Dark mode toggle
-  Mobile responsive layout

---

## 👤 Author

<div align="center">

**Sujal Suyash**

[![GitHub](https://img.shields.io/badge/GitHub-sujalsuyash-181717?style=flat-square&logo=github)](https://github.com/sujalsuyash)
[![Email](https://img.shields.io/badge/Email-yadavsujal2507%40gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white)](mailto:yadavsujal2507gmail.com)

</div>


<div align="center">

*Built with curiosity, caffeine, and too many research papers.*

**⭐ Star this repo if you found it useful!**

</div>