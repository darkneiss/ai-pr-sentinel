# ADR-002: Prompt Registry, Versioning, and Asset Copy

## Status
Accepted (2026-02-09)

## Context
We want versioned prompts with optional provider-specific variants (Gemini, Groq, Ollama) and a generic fallback. Prompts should be easy to edit and diff, and the registry should be selectable by provider/version without breaking the existing JSON contract used by the AI triage pipeline.

The project builds with `tsc` (no bundler). Non-code assets (e.g., `.yaml`) are not copied to `dist/` automatically.

## Decision
1. **Prompt Registry**
   - Store prompt definitions as YAML files under:
     - `apps/api/src/shared/application/prompts/issue-triage/`
   - File naming:
     - `issue-triage.v<version>.<provider>.yaml`
     - Examples:
       - `issue-triage.v1.0.0.generic.yaml`
       - `issue-triage.v1.0.0.gemini.yaml`
       - `issue-triage.v1.1.0-beta.ollama.yaml`
   - YAML schema (minimum):
     - `version` (semver)
     - `provider` (`generic|gemini|groq|ollama`)
     - `config` (optional: temperature, max_tokens, etc.)
     - `system_prompt`
     - `user_prompt_template` (supports `{{issue_title}}`, `{{issue_body}}`, `{{repository_context}}`, `{{recent_issues}}`)
     - `output_contract` (informational: required JSON schema)

2. **Selection Rules**
   - Choose provider-specific prompt if present; else fall back to `generic`.
   - Choose version from config/env (`PROMPT_VERSION`); if missing, use the highest available version for that provider.
   - The output **must** conform to the existing JSON contract:
     - `classification`, `duplicateDetection`, `sentiment`, `suggestedResponse`.
   - Any change to output schema requires a new ADR and migration.

3. **Asset Copy in Build**
   - Because there is no bundler, YAML prompt files must be copied to `dist/` during build.
   - Build pipeline must include a copy step for `apps/api/src/shared/application/prompts/**`.

## Consequences
- Prompts are versioned and can be tailored per provider without changing application logic.
- Build pipeline must explicitly copy YAML assets.
- Prompt registry remains in the **Application** layer (not Infrastructure), preserving Hexagonal boundaries.

## Notes
- Prompt injection guardrails are mandatory in every prompt.
- The registry will be cached in memory on startup (no per-request file I/O).
