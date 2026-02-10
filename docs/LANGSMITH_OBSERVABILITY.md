# LangSmith Observability

## Purpose
Provide opt-in visibility for LLM calls (timings, inputs/outputs metadata, errors) without coupling application logic to any vendor. This is strictly an infrastructure concern behind a port.

## How It Works
- Application uses the `LLMObservabilityGateway` port.
- The `createObservedLlmGateway` decorator wraps the LLM gateway and reports request/response/error.
- The LangSmith adapter implements the port via HTTP `/runs` (create) and `/runs/{id}` (update).
- If observability fails, the LLM flow continues (fail-open).

## Data Safety
- Sensitive keys are redacted (api_key, authorization, token, etc.).
- Long text is truncated.
- Prompts are redacted in production (`NODE_ENV=production`).

## Enablement
Set `LANGSMITH_TRACING=true` and provide a LangSmith API key.

### Environment Variables
- `LANGSMITH_TRACING=true` (required to enable)
- `LANGSMITH_API_KEY` (required)
- `LANGSMITH_ENDPOINT` (optional, default: `https://api.smith.langchain.com`)
- `LANGSMITH_PROJECT` (optional, used as session name)
- `LANGSMITH_WORKSPACE_ID` (optional, sent as `x-tenant-id`)

### Example
```bash
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=your_langsmith_key
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_PROJECT=ai-pr-sentinel
LANGSMITH_WORKSPACE_ID=your_workspace_id
```

## Operational Notes
- Observability does not affect LLM execution when unavailable.
- The run name/type are consistent with the AI triage flow.
