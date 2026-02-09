# Prompt Registry & Versioning

This document explains how prompt versioning works in **AI-PR-Sentinel** and how to manage provider-specific prompts.

## Location
Prompt definitions are stored as YAML files under:
`apps/api/src/shared/application/prompts/issue-triage/`

## File Naming
`issue-triage.v<version>.<provider>.yaml`

Examples:
- `issue-triage.v1.0.0.generic.yaml`
- `issue-triage.v1.1.0.gemini.yaml`
- `issue-triage.v1.1.0.ollama.yaml`

## Selection Rules
1. The registry selects by provider (from `LLM_PROVIDER`).
2. If a provider-specific prompt does not exist, it falls back to `generic`.
3. If `PROMPT_VERSION` is set, that exact version is used.
4. If `PROMPT_VERSION` is not set, the **highest available version** for that provider is selected.

Environment variables:
- `LLM_PROVIDER` (e.g., `gemini`, `groq`, `ollama`)
- `PROMPT_VERSION` (optional, exact version like `1.1.0`)
- `PROMPT_REGISTRY_PATH` (optional override for registry folder)

## YAML Schema
Minimum required fields:
```yaml
version: "1.1.0"
provider: "ollama"
system_prompt: |
  ...
user_prompt_template: |
  ...
```

Optional:
```yaml
config:
  temperature: 0.2
  max_tokens: 512
output_contract: |
  JSON with classification, duplicateDetection, sentiment, suggestedResponse
```

Template variables available in `user_prompt_template`:
- `{{issue_title}}`
- `{{issue_body}}`
- `{{repository_context}}`
- `{{recent_issues}}`

## Output Contract
All prompts **must** respect the existing JSON contract:
- `classification`
- `duplicateDetection`
- `sentiment`
- `suggestedResponse`

Changing the output schema requires a new ADR and a coordinated migration.

## Build & Runtime Notes
This project uses `tsc` without a bundler. YAML assets must be copied to `dist/` during build.
See `docs/adr/ADR-002-prompt-registry-and-assets-copy.md` for details.

## Troubleshooting
- If prompts are not found, check `PROMPT_REGISTRY_PATH` and the build copy step.
- If the wrong version is used, confirm `PROMPT_VERSION` and available files in the registry.
- If provider-specific prompts are ignored, confirm `LLM_PROVIDER` and that a matching file exists.
