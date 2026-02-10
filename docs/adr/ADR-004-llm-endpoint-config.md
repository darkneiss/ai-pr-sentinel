# ADR-004: LLM Endpoint Configuration (Gemini, Groq, Ollama)

## Status
Accepted (2026-02-10)

## Context
We want consistent, predictable LLM endpoint configuration across providers while avoiding API keys in URLs. Historically, adapters appended provider-specific paths, which reduced flexibility when pointing to proxies or custom routes. Gemini also used query-string API keys, which is not ideal for security.

## Decision
- **Groq**
  - Treat `LLM_BASE_URL`/`GROQ_BASE_URL` as the full Groq endpoint.
  - The adapter does not append any path segments.
  - Example: `https://api.groq.com/openai/v1/chat/completions`
- **Ollama**
  - Treat `LLM_BASE_URL`/`OLLAMA_BASE_URL` as the full Ollama endpoint for `generate`.
  - The adapter does not append any path segments.
  - Example: `http://127.0.0.1:11434/api/generate`
- **Gemini**
  - Treat `LLM_BASE_URL`/`GEMINI_BASE_URL` as a base Gemini API URL (no model path required).
  - If the URL already contains `/models/`, use it as-is; otherwise append `/models/{model}:generateContent`.
  - Send the Gemini API key via the `x-goog-api-key` header (not in the URL).
  - Example base URL: `https://generativelanguage.googleapis.com/v1beta`

## Consequences
### Positive
- Allows custom or proxied endpoints without code changes.
- Eliminates implicit URL mutation for Groq and Ollama.
- Avoids exposing Gemini API keys in URLs.

### Negative
- Misconfigured env values without the expected path can fail (notably for Groq/Ollama).

## Alternatives Considered
1. Keep auto-append provider paths
   - Rejected: prevents full endpoint overrides.
2. Keep Gemini `?key=` query parameter
   - Rejected: exposes API key in URLs.
2. Add a separate `OLLAMA_ENDPOINT` env var
   - Rejected: extra configuration surface area for a single provider.
