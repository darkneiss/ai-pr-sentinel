# AI Context & Technical State

> FILE PURPOSE: current technical snapshot for AI agents before making changes.

## 1. Project Identity
- Name: AI-PR-Sentinel
- Goal: GitHub governance + AI triage bot for repository issues.
- Stack: Node.js (v22), Express, TypeScript, Jest, pnpm workspaces.
- Architecture: Hexagonal (Domain/Application/Infrastructure) + shared kernel.

## 2. Current Status (2026-02-08)

### Feature 001: Basic Governance
- Status: DONE
- Behavior:
  - Deterministic validation (title/body/author + spam rules).
  - Governance actions for invalid issues (`triage/needs-info` + comment).
  - Label cleanup when issue becomes valid.

### Feature 002: AI-Enhanced Issue Triage
- Status: DONE (MVP)
- Behavior implemented:
  - Semantic classification (`kind/bug`, `kind/feature`, `kind/question`) with confidence threshold.
  - Hostile-priority guard:
    - When tone is hostile with enough confidence, `kind/*` labels are suppressed/removed.
  - Duplicate detection (`triage/duplicate` + comment).
  - Duplicate fallback behavior:
    - If AI flags duplicate with high similarity but omits an original issue reference, the system can fallback to a recent issue number.
    - Fallback is disabled when AI explicitly provides a reference field (even if invalid), to avoid masking malformed provider output.
  - Tone check (`triage/monitor` for hostile tone).
  - Suggested setup reply for questions:
    - AI-provided response preferred.
    - fallback checklist if AI does not provide usable setup content.
  - Idempotency guards (avoid duplicated labels/comments).
  - Fail-open policy across LLM/provider/parsing/governance failures.

## 3. LLM & Provider Layer
- Port: `LLMGateway` (provider-agnostic).
- Factory: `src/infrastructure/composition/llm-gateway.factory.ts`.
- Adapters implemented:
  - Gemini
  - Groq
  - Ollama
- Prompting:
  - Centralized in `src/shared/application/prompts/issue-triage.prompt.ts`.
  - JSON-only response contract enforced.

## 4. Repository Context Enrichment
- New port: `RepositoryContextGateway`.
- Adapter: `GithubRepositoryContextAdapter`.
- Current context source:
  - README content fetched from GitHub and injected into AI triage prompt.
- Resilience:
  - If repository context cannot be loaded, triage continues without context (fail-open).

## 5. Observability & Metrics
- Environment-based logger active (debug/info/warn/error behavior by level).
- Duplicate detection logs include whether fallback original issue resolution was used.
- Question response source metric:
  - `aiSuggestedResponse`
  - `fallbackChecklist`
  - `total`

## 6. Testing & Quality
- Test strategy:
  - Domain + application use cases heavily unit-tested.
  - Infrastructure adapters tested with mocks.
  - Additional branch tests for normalization/fallback/error-shape paths.
- Current quality gate:
  - `pnpm --filter api lint`: passing
  - `pnpm --filter api test`: passing
  - Coverage currently at 100% (statements, branches, functions, lines) for `apps/api`.

## 7. Working Rules (Operational)
- TDD in local is mandatory: RED -> GREEN -> REFACTOR.
- Existing passing tests are treated as immutable for feature evolution.
- No magic strings for governance/AI labels and prompts.
- Preserve Hexagonal boundaries:
  - Domain has no infra dependencies.
  - Application depends on ports, not adapters.

## 8. Immediate Next Focus
- Continue feature development using ports-first approach.
- Keep provider behavior normalized in adapters + use-case normalization.
- Evaluate whether duplicate fallback should prefer semantic nearest recent issue (instead of first recent non-current issue) in a future iteration.
- Document significant design decisions in ADRs and keep this file synchronized with shipped behavior.

## 9. ADR References
- `docs/adr/ADR-001-llm-integration-strategy.md`
  - Justifies the MVP decision to avoid LangChain and provider SDKs in core AI triage flow.
