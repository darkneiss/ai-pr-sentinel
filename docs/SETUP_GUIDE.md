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
   SCM_PROVIDER=github
   SCM_TOKEN=your_token_from_step_1
   # Local with smee tunnel (recommended): leave secret empty
   SCM_WEBHOOK_SECRET=

   # Direct webhook / production:
   # SCM_WEBHOOK_SECRET=your_webhook_secret_from_step_3
   ```

4. Signature verification policy:
   * In **production**, signature verification is mandatory and `SCM_WEBHOOK_SECRET` is required.
   * In **development**, verification is enabled only when `SCM_WEBHOOK_SECRET` is set.
   * Optional advanced override: `SCM_WEBHOOK_VERIFY_SIGNATURE=true|false`.
   * If verification is enabled and `SCM_WEBHOOK_SECRET` is missing, the app fails fast on startup.

5. SCM provider policy:
   * Current supported value is `SCM_PROVIDER=github`.
   * Unsupported values fail fast during app composition.

6. Configure the AI provider (Groq, Gemini, or Ollama):
   * Select provider with `LLM_PROVIDER`:
     * `groq` for Groq (OpenAI-compatible)
     * `gemini` for Google Gemini API
     * `ollama` for local models via Ollama
   * Set generic variables:
     * `LLM_API_KEY`
     * `LLM_MODEL`
     * `LLM_BASE_URL`
   * **Groq URL rule (important):**
     * The adapter uses `LLM_BASE_URL` exactly as provided.
     * Include `/v1/chat/completions` in `LLM_BASE_URL`.
   * Example for Groq:
   ```ini
   LLM_PROVIDER=groq
   LLM_API_KEY=your_groq_api_key
   LLM_MODEL=openai/gpt-oss-20b
   LLM_BASE_URL=https://api.groq.com/openai/v1/chat/completions
   ```
   * Example for Gemini:
   ```ini
   LLM_PROVIDER=gemini
   LLM_API_KEY=your_gemini_api_key
   LLM_MODEL=gemini-2.5-flash-lite
   LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta
   ```
   * Example for Ollama:
   ```ini
   LLM_PROVIDER=ollama
   LLM_API_KEY=
   LLM_MODEL=llama3.1
   LLM_BASE_URL=http://127.0.0.1:11434/api/generate
   ```

7. Optional: override AI temperature globally:
   * Variable: `AI_TEMPERATURE`
   * Range: `0` to `1`
   * Default: `0.1`
   * Applies to all providers when prompt config does not define temperature.
   * Example:
   ```ini
   AI_TEMPERATURE=0.2
   ```

8. Optional: map AI classification labels to your repository taxonomy:
   * These variables map AI semantic kinds (`bug|feature|question`) to GitHub labels.
   * If not set, defaults are used:
     * `kind/bug`
     * `kind/feature`
     * `kind/question`
   * Example for GitHub default labels:
   ```ini
   AI_LABEL_KIND_BUG=bug
   AI_LABEL_KIND_FEATURE=enhancement
   AI_LABEL_KIND_QUESTION=question
   ```

9. Optional: map conservative AI curation recommendations to GitHub labels:
   * These variables map optional AI recommendations (`documentation`, `help wanted`, `good first issue`) to labels.
   * The bot only applies them with high confidence and conservative domain rules.
   * If not set, defaults are used:
     * `documentation`
     * `help wanted`
     * `good first issue`
   * Example:
   ```ini
   AI_LABEL_DOCUMENTATION=documentation
   AI_LABEL_HELP_WANTED=help wanted
   AI_LABEL_GOOD_FIRST_ISSUE=good first issue
   ```

10. Optional: tune AI curation confidence thresholds:
   * Use values between `0` and `1`.
   * Higher values are more conservative.
   * Defaults:
     * `AI_LABEL_DOCUMENTATION_CONFIDENCE_THRESHOLD=0.9`
     * `AI_LABEL_HELP_WANTED_CONFIDENCE_THRESHOLD=0.9`
     * `AI_LABEL_GOOD_FIRST_ISSUE_CONFIDENCE_THRESHOLD=0.95`
   * Example (slightly less strict for `help wanted`):
   ```ini
   AI_LABEL_DOCUMENTATION_CONFIDENCE_THRESHOLD=0.9
   AI_LABEL_HELP_WANTED_CONFIDENCE_THRESHOLD=0.8
   AI_LABEL_GOOD_FIRST_ISSUE_CONFIDENCE_THRESHOLD=0.95
   ```

11. Optional: tune core AI decision thresholds:
   * Use values between `0` and `1`.
   * Defaults:
     * `AI_CLASSIFICATION_CONFIDENCE_THRESHOLD=0.8`
     * `AI_SENTIMENT_CONFIDENCE_THRESHOLD=0.75`
     * `AI_DUPLICATE_SIMILARITY_THRESHOLD=0.85`
   * Example:
   ```ini
   AI_CLASSIFICATION_CONFIDENCE_THRESHOLD=0.75
   AI_SENTIMENT_CONFIDENCE_THRESHOLD=0.7
   AI_DUPLICATE_SIMILARITY_THRESHOLD=0.85
   ```

12. Optional: enable LangSmith observability:
   * Set `LANGSMITH_TRACING=true`
   * Provide `LANGSMITH_API_KEY`
   * Optional: `LANGSMITH_PROJECT`, `LANGSMITH_ENDPOINT`, `LANGSMITH_WORKSPACE_ID`

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
