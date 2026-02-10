# ADR-003: LLM Observability via LangSmith (Opt-In)

## Status
Proposed (2026-02-10)

## Context
We need better visibility into LLM requests/responses (timings, failure rates, prompt selection, and model behavior), especially across multiple providers (Gemini, Groq, Ollama). We want this without breaking Hexagonal Architecture or coupling application/domain logic to a specific vendor.

## Decision
1. **Introduce a provider-agnostic observability port**
   - Add `LLMObservabilityGateway` under `apps/api/src/shared/application/ports/`.
   - The port exposes minimal methods such as:
     - `trackRequest(...)`
     - `trackResponse(...)`
     - `trackError(...)`
   - The port uses neutral data structures (no LangSmith-specific types).

2. **Implement LangSmith adapter in Infrastructure**
   - Create `LangSmithObservabilityAdapter` under `apps/api/src/shared/infrastructure/observability/`.
   - Adapter is only constructed when `LANGSMITH_ENABLED=true`.
   - Uses `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`, and optional `LANGSMITH_ENDPOINT`.

3. **Wrap LLMGateway with an instrumented decorator**
   - Create an `LLMGateway` decorator that calls the observability gateway before/after `generateJson`.
   - The decorator is injected in the composition root/factory only when LangSmith is enabled.

4. **Privacy and safety guarantees**
   - Never send secrets or headers.
   - Redact known sensitive fields (`api_key`, `authorization`, `token`, etc.).
   - Allow prompt truncation for logs (e.g., max 2k chars) and a production-safe mode.

## Consequences
### Positive
- Observability is optional and infrastructure-only.
- Keeps application/domain logic provider-agnostic.
- Improves debugging for model behavior and prompt issues.

### Negative
- Adds minor overhead per request when enabled.
- Requires careful redaction and configuration discipline.
- Additional infra code and env configuration to maintain.

## Alternatives Considered
1. **LangSmith SDK directly in adapters**
   - Rejected: tight coupling and harder to disable.
2. **OpenTelemetry-only tracing**
   - Deferred: can be added later, but LangSmith provides LLM-specific visibility sooner.
3. **No observability**
   - Rejected: insufficient for diagnosing provider differences and prompt behavior.

## References (Official Examples, Not Adopted)
These are official LangSmith examples for SDK-based integrations. We list them as reference only; they are not aligned with our ADR-001 decision to avoid SDKs in the core flow.

- **Anthropic / Claude SDK + LangSmith**
  - Dependencies: `@anthropic-ai/claude-agent-sdk`, `langsmith`, `zod`
  - Env:
    - `LANGSMITH_TRACING=true`
    - `LANGSMITH_ENDPOINT=https://eu.api.smith.langchain.com`
    - `LANGSMITH_API_KEY=...`
    - `LANGSMITH_PROJECT=...`
    - `ANTHROPIC_API_KEY=...`
  - Example: `wrapClaudeAgentSDK` + MCP tools

- **OpenAI SDK + LangSmith**
  - Dependencies: `langsmith`, `openai`
  - Example: `wrapOpenAI` + `traceable` pipeline

## Revisit Criteria
- If vendor lock-in or cost becomes a concern.
- If OpenTelemetry provides sufficient LLM visibility with less coupling.
- If prompt/response privacy requirements tighten.
