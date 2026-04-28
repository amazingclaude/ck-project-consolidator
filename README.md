# CK Project Consolidator

A web dashboard for managing and analysing EV charging infrastructure deployment plans. Upload Excel plan files, track delivery metrics, analyse costs and schedules, and chat with an AI assistant backed by Azure AI Foundry.

## Features

- **Portfolio Overview** — aggregate view across all active plans
- **Plan Management** — upload, update, and delete Excel-based deployment plans
- **Schedule & Cost Analysis** — monthly socket targets vs actuals, CapEx breakdown
- **Business Planning** — workforce and asset value projections
- **AI Assistant** — chat interface powered by Azure AI Foundry

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Python FastAPI + Uvicorn
- **Storage**: Azure Blob Storage
- **AI**: Azure AI Foundry (chat completions or project agents)

## Local Development

### Prerequisites

- Node.js 20+
- Python 3.11+
- An Azure Storage account
- (Optional) Azure AI Foundry endpoint for the AI assistant

### Setup

1. Install frontend dependencies:

   ```bash
   npm install
   ```

2. Install Python dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Copy the environment template and fill in your values:

   ```bash
   cp .env.example .env
   ```

4. Copy the assumptions template:

   ```bash
   cp data/assumptions.example.json data/assumptions.json
   ```

   Edit `data/assumptions.json` with your delivery capacity and value-per-socket figures.

### Running

Local development requires two processes running in parallel:

**Terminal 1 — Frontend dev server:**
```bash
npm run dev
```

**Terminal 2 — Backend API:**
```bash
python app.py
```

The frontend runs at `http://localhost:5173` and proxies `/api/*` requests to the FastAPI backend at `http://localhost:8000`.

## Deployment (Azure App Service)

### 1. Build the frontend

```bash
npm run build
```

This compiles the React app into `dist/`. In production, FastAPI serves these static files directly — no separate frontend process is needed.

### 2. Deploy via VS Code

Use the **Azure App Service** VS Code extension to deploy the project folder. Make sure `dist/` exists before deploying.

### 3. Set startup command

In Azure Portal → App Service → **Configuration → General settings**, set the startup command to:

```
gunicorn -k uvicorn.workers.UvicornWorker app:app --bind=0.0.0.0:$PORT
```

### 4. Set environment variables

In Azure Portal → App Service → **Configuration → Application settings**, add:

| Name | Value |
|---|---|
| `ENV` | `production` |
| `AZURE_STORAGE_CONNECTION_STRING` | your storage account connection string |
| `AZURE_STORAGE_CONTAINER` | `plans` (or your container name) |
| `ASSUMPTIONS_PATH` | `data/assumptions.json` |
| `AI_FOUNDRY_ENDPOINT` | your AI Foundry endpoint |
| `AI_FOUNDRY_API_KEY` | your API key |
| `AI_FOUNDRY_DEPLOYMENT` | your deployment name |
| `AI_FOUNDRY_AGENT_NAME` | (if using project agents) |
| `AI_FOUNDRY_AGENT_VERSION` | (if using project agents) |
| `AI_FOUNDRY_API_VERSION` | `2024-05-01-preview` |

## Environment Variables Reference

See [.env.example](.env.example) for descriptions of all variables.

---

## Deployment Pitfalls

### 1. Oryx skips Python build due to mixed project structure

**Symptom:**
```
ModuleNotFoundError: No module named 'uvicorn'
WARNING: Could not find virtual environment directory /home/site/wwwroot/antenv.
Could not find build manifest file at '/home/site/wwwroot/oryx-manifest.toml'
```

**Cause:** This repo has both a Python backend (`requirements.txt`) and a React frontend (`package.json`). Azure's Oryx build system sees multiple platform signals and fails to build the Python environment.

**Fix:** The `.python-version` file at the repo root explicitly tells Oryx to build Python. Do not remove it.

---

### 2. `SCM_DO_BUILD_DURING_DEPLOYMENT` must be set before deploying

**Cause:** Setting `SCM_DO_BUILD_DURING_DEPLOYMENT=true` in Azure App Settings only takes effect on the **next deployment**. Restarting the app is not enough.

**Fix:** Set the flag first, then redeploy from VS Code.

---

### 3. `start.sh` is unreachable when Oryx build succeeds

**Cause:** When Oryx builds successfully, it compresses the app into `output.tar.zst` and extracts it to a temp directory (e.g. `/tmp/8dea4ff2e12351d/`) at startup — not to `/home/site/wwwroot/`. A startup command pointing to `bash /home/site/wwwroot/start.sh` will fail with `No such file or directory`.

**Fix:** Set the startup command directly to the gunicorn command, not to `start.sh`.
