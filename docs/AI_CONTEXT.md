# AI Context & Technical State

> FILE PURPOSE: current technical snapshot for AI agents before making changes.

## 1. Project Identity
- Name: AI-PR-Sentinel
- Goal: GitHub governance + AI triage bot for repository issues.
- Stack: Node.js (v22), Express, TypeScript, Jest, pnpm workspaces.
- Architecture: Hexagonal (Domain/Application/Infrastructure) + shared kernel.

## 2. Current Status (2026-02-11)

### Feature 001: Basic Governance
- Status: DONE
- Behavior:
  - Deterministic validation (title/body/author + spam rules).
  - Governance actions for invalid issues (`triage/needs-info` + comment).
  - Label cleanup when issue becomes valid.
  - Webhook governance planning (`supported action` + `valid/invalid action plan`) is now
    centralized in domain via `issue-webhook-governance-plan.service.ts`.
  - Webhook governance plan now precomputes an executable domain action list
    (`add_label` | `remove_label` | `create_comment` | `log_validated_issue`) consumed
    directly by `process-issue-webhook.use-case`.

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

### Webhook Ingress Security Hardening
- Status: DONE (Phase 1 baseline)
- Behavior implemented:
  - Repository authorization policy before webhook processing via allowlist adapter.
  - Delivery-level replay protection with `X-GitHub-Delivery` deduplication.
  - Delivery registration rollback on downstream processing failures to preserve retryability of the same delivery id.
  - Configurable strict mode for missing delivery id header.
  - In-memory TTL dedup adapter wired by default in composition root.
  - Config surface:
    - `GITHUB_WEBHOOK_ALLOWED_REPOSITORIES`
    - `GITHUB_WEBHOOK_STRICT_REPOSITORY_ALLOWLIST`
    - `GITHUB_WEBHOOK_REQUIRE_DELIVERY_ID`
    - `GITHUB_WEBHOOK_DELIVERY_TTL_SECONDS`

## 3. LLM & Provider Layer
- Port: `LLMGateway` (provider-agnostic).
- Factory: `src/infrastructure/composition/llm-gateway.factory.ts`.
- Adapters implemented:
  - Gemini
  - Groq
  - Ollama
  - Endpoint rules:
    - Groq: `LLM_BASE_URL` is the full endpoint (no path appended).
    - Ollama: `LLM_BASE_URL` is the full `/api/generate` endpoint (no path appended).
    - Gemini: `LLM_BASE_URL` is a base URL; the adapter appends `/models/{LLM_MODEL}:generateContent` only when `/models/` is missing.
    - Gemini API key is sent via the `x-goog-api-key` header (no query param).
- Prompting:
  - Versioned YAML registry under `src/shared/application/prompts/issue-triage/`.
  - Runtime selection by provider/version with generic fallback.
  - Legacy fallback still available in `src/shared/application/prompts/issue-triage.prompt.ts`.
  - JSON-only response contract enforced.
  - AI triage action planning is now centralized in domain via
    `issue-ai-triage-action-plan.service.ts`, while application services execute the precomputed plan.
  - Application action executors (`apply-classification/duplicate/question-response`) now require
    a precomputed plan and fail fast if it is missing (no domain-recomputation fallback in application).
  - `apply-ai-triage-governance-actions` now forwards domain plan slices directly
    (`duplicate`, `question`) without remapping execution-plan DTOs in application.
  - Final publication decision for question-response comments (including existing-comment gate and
    comment body construction) is now centralized in domain
    via `decideIssueQuestionResponseCommentPublication`.
  - Pre-history publication preparation for question responses (including
    `missing_publication_plan` short-circuit) is now centralized in domain via
    `decideIssueQuestionResponseCommentPublicationPreparation`.
  - Question-response pre-history publication preparation is now precomputed in the
    domain action plan (`question.publicationPreparation`) and consumed directly by
    `apply-question-response-governance-actions`.
  - Question-response history lookup prefix is now precomputed in domain
    (`question.publicationPreparation.historyLookupBodyPrefix`) and consumed by
    `apply-question-response-governance-actions` when checking prior bot replies.
  - Question-response publication decisions now expose explicit domain skip reasons
    (`missing_publication_plan` | `question_reply_comment_already_exists`) for deterministic
    application logging/branching.
  - Label transition execution decisions (`add`/`remove`) are now centralized in domain
    (`decideIssueLabelAddExecution`, `decideIssueLabelRemoveExecution`) and consumed by the
    AI triage application context, including explicit skip reasons in logs.
  - Kind-label planning now avoids producing redundant add operations when the target `kind/*`
    label is already present (no-op add filtered at domain decision level).
  - Classification suppression observability gate is now centralized in domain via
    `decideIssueKindSuppressionLogDecision` and consumed by application orchestration.
  - Duplicate execution gating (signal/decision/comment-plan readiness) is now centralized in domain
    via `decideIssueDuplicateGovernanceExecution`.
  - Duplicate execution output is now embedded in the domain action plan
    (`duplicate.execution`) and consumed directly by `apply-duplicate-governance-actions`.
  - Final duplicate-comment publication gate (execution actionable + newly added duplicate label)
    is now centralized in domain via `decideIssueDuplicateCommentExecution`.
  - Duplicate skipped-info log emission is now centralized in domain via
    `decideIssueDuplicateSkippedLogDecision` (only emits for actionable/loggable skip reasons).
  - Tone monitor actions are now represented as domain-planned label operations
    (`tone.labelsToAdd`) consumed directly by application orchestration.

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
  - AI response parsing/normalization is now modeled as domain policy services (`issue-ai-analysis-*`), keeping application focused on orchestration.
- Question response source metric:
  - `aiSuggestedResponse`
  - `fallbackChecklist`
  - `total`
- Optional LangSmith observability:
  - Enabled via `LANGSMITH_TRACING=true`.
  - Uses `LANGSMITH_API_KEY` and optional `LANGSMITH_PROJECT`, `LANGSMITH_ENDPOINT`, `LANGSMITH_WORKSPACE_ID`.
  - Requests/responses are sanitized (redaction + truncation) before sending.
  - See `docs/LANGSMITH_OBSERVABILITY.md` for the operational checklist.

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
- `docs/adr/ADR-002-prompt-registry-and-assets-copy.md`
  - Defines versioned prompt registry and build-time asset copy for YAML prompts.
- `docs/adr/ADR-003-llm-observability-langsmith.md`
  - Documents optional LangSmith tracing integration and safeguards.
- `docs/adr/ADR-004-llm-endpoint-config.md`
  - Documents LLM endpoint configuration rules for Gemini, Groq, and Ollama.
- `docs/adr/ADR-005-webhook-ingress-hardening.md`
  - Documents webhook ingress allowlist and delivery deduplication strategy.
- `docs/adr/README.md`
  - ADR index.
