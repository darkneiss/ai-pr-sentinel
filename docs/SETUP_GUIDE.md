# Development Setup Guide

This guide explains how to configure a local environment to develop and test **AI-PR-Sentinel**.

## Prerequisites

* **Node.js** (v22 - check .nvmrc)
* **pnpm** (package manager)
* A **GitHub** account
* **Smee.io** (to receive webhooks locally)

---

## 1. Generate GitHub Credentials (Development Mode)

For local development, use a **fine-grained Personal Access Token**.

1. Go to [GitHub > Settings > Developer settings > Personal access tokens > Fine-grained tokens](https://github.com/settings/personal-access-tokens/new).
2. Click **Generate new token**.
3. **Name:** `AI-PR-Sentinel-Dev` (or similar).
4. **Expiration:** 30 days (recommended for development).
5. **Repository access:** Select **"Only select repositories"** and choose your test repository (for example: `sandbox-sentinel`).
6. **Permissions (Repository permissions):**
   * Open **Issues** and select: `Read and Write`.
   * Open **Contents** and select: `Read-only` (required to fetch repository README for AI context).
   * *(Note: Metadata is automatically set to Read-only.)*
7. Click **Generate token**.
8. Copy the token (`github_pat_...`). You will not be able to see it again.

---

## 2. Configure the Webhook Tunnel (Smee.io)

You need to expose your local server to GitHub.

1. Go to [smee.io](https://smee.io/).
2. Click **Start a new channel**.
3. Copy the **Webhook Proxy URL** (for example: `https://smee.io/XyZ...`).

---

## 3. Configure the Test Repository

1. In your GitHub repository (`sandbox-sentinel`):
2. Go to **Settings > Webhooks > Add webhook**.
3. **Payload URL:** Paste your Smee URL (from the previous step).
4. **Content type:** Select `application/json`.
5. **Secret (recommended):** Generate a random string and paste it here (for example: `openssl rand -hex 32`).
6. **Events:** Select "Let me select individual events" and check **Issues**.
7. Click **Add webhook**.
8. **Create labels:** Go to **Issues > Labels** and create a label named `triage/needs-info` (red is recommended).

---

## 4. Configure the Local Project

1. Clone the repository and install dependencies:
   ```bash
   nvm use
   pnpm install
   ```

2. Create the environment file in `apps/api`:
   ```bash
   cd apps/api
   cp .env.example .env
   ```

3. Edit `.env` with your values:
   ```ini
   PORT=3000
   APP_VERSION=1.0.0
   GITHUB_TOKEN=your_token_from_step_1
   # Local with smee tunnel (recommended): leave secret empty
   GITHUB_WEBHOOK_SECRET=

   # Direct webhook / production:
   # GITHUB_WEBHOOK_SECRET=your_webhook_secret_from_step_3
   ```

4. Signature verification policy:
   * In **production**, signature verification is mandatory and `GITHUB_WEBHOOK_SECRET` is required.
   * In **development**, verification is enabled only when `GITHUB_WEBHOOK_SECRET` is set.
   * Optional advanced override: `GITHUB_WEBHOOK_VERIFY_SIGNATURE=true|false`.
   * If verification is enabled and `GITHUB_WEBHOOK_SECRET` is missing, the app fails fast on startup.

5. Configure the AI provider (OpenAI-compatible, Gemini, or Ollama):
   * Select provider with `LLM_PROVIDER`:
     * `openai` for OpenAI-compatible APIs (OpenAI, Groq, etc.)
     * `gemini` for Google Gemini API
     * `ollama` for local models via Ollama
   * Set generic variables:
     * `LLM_API_KEY`
     * `LLM_MODEL`
     * `LLM_BASE_URL`
   * **OpenAI-compatible URL rule (important):**
     * The adapter always calls `LLM_BASE_URL + /v1/chat/completions`.
     * Do not include `/v1/chat/completions` in `LLM_BASE_URL`.
   * Example for Groq:
   ```ini
   LLM_PROVIDER=openai
   LLM_API_KEY=your_groq_api_key
   LLM_MODEL=openai/gpt-oss-20b
   LLM_BASE_URL=https://api.groq.com/openai
   ```
   * Example for OpenAI:
   ```ini
   LLM_PROVIDER=openai
   LLM_API_KEY=your_openai_api_key
   LLM_MODEL=gpt-4o-mini
   LLM_BASE_URL=https://api.openai.com
   ```
   * Example for Gemini:
   ```ini
   LLM_PROVIDER=gemini
   LLM_API_KEY=your_gemini_api_key
   LLM_MODEL=gemini-2.5-flash-lite
   LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta
   ```

---

## 5. Run Locally

You will need **two terminals**:

**Terminal 1 (Smee tunnel):**
Forward external webhook traffic to your local port.

```bash
# Replace the URL with your own smee.io channel
npx smee-client --url https://smee.io/YOUR_SMEE_CHANNEL --path /webhooks/github --port 3000
```

**Terminal 2 (API server):**
Run the API in development mode.

```bash
pnpm --filter api dev
```

## Verification (Smoke Test)
Go to your sandbox repository on GitHub.
Create a new Issue with a very short title (e.g., "Bug") and short description (e.g., "Fails").
Check Terminal 2: You should see logs processing the issue.
Refresh GitHub: The issue should now have the triage/needs-info label and a comment from the bot.
Edit the Issue with a long title and description. The label should disappear automatically.

---

## 6. Optional: Enable Commit Template

To standardize commit messages locally:

```bash
git config commit.template docs/COMMIT_TEMPLATE.md
```
