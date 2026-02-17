# AI Context & Technical State

> FILE PURPOSE: current technical snapshot for AI agents before making changes.

## 1. Project Identity
- Name: AI-PR-Sentinel
- Goal: GitHub governance + AI triage bot for repository issues.
- Stack: Node.js (v22), Express, TypeScript, Jest, pnpm workspaces.
- Architecture: Hexagonal (Domain/Application/Infrastructure) + shared kernel.

## 2. Current Status (2026-02-13)

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
  - Webhook processing now uses an explicit domain workflow service
    (`issue-webhook-workflow.service.ts`) that centralizes:
    - skip/continue processing decision,
    - identity resolution,
    - issue entity creation,
    - governance plan derivation.
  - GitHub payload adaptation is now isolated in infrastructure anti-corruption mapper
    (`github-issue-webhook-command.mapper.ts`) before invoking the use-case.

### Feature 002: AI-Enhanced Issue Triage
- Status: DONE (MVP)
- Behavior implemented:
  - Semantic classification with confidence threshold.
    - Thresholds are configurable via env:
      - `AI_CLASSIFICATION_CONFIDENCE_THRESHOLD`
      - `AI_SENTIMENT_CONFIDENCE_THRESHOLD`
      - `AI_DUPLICATE_SIMILARITY_THRESHOLD`
    - Default labels: `kind/bug`, `kind/feature`, `kind/question`.
    - Optional repository label mapping via config:
      - `AI_LABEL_KIND_BUG`
      - `AI_LABEL_KIND_FEATURE`
      - `AI_LABEL_KIND_QUESTION`
  - Conservative curation label recommendations from AI analysis:
    - Optional labels:
      - `documentation`
      - `help wanted`
      - `good first issue`
    - Optional repository label mapping via config:
      - `AI_LABEL_DOCUMENTATION`
      - `AI_LABEL_HELP_WANTED`
      - `AI_LABEL_GOOD_FIRST_ISSUE`
    - Confidence thresholds are configurable via env:
      - `AI_LABEL_DOCUMENTATION_CONFIDENCE_THRESHOLD`
      - `AI_LABEL_HELP_WANTED_CONFIDENCE_THRESHOLD`
      - `AI_LABEL_GOOD_FIRST_ISSUE_CONFIDENCE_THRESHOLD`
    - Applied only with high-confidence thresholds and conservative domain conditions.
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
  - SCM provider resolution is now validated during composition:
    - `SCM_PROVIDER` defaults to `github`.
    - unsupported providers fail fast on startup.
  - Provider-specific infrastructure wiring is now centralized in a registry:
    - `src/infrastructure/composition/scm-provider-integration.registry.ts`
    - route/controller + governance/history/context adapter factories are resolved per provider.
  - Config surface:
    - `SCM_PROVIDER`
    - `SCM_WEBHOOK_ALLOWED_REPOSITORIES`
    - `SCM_WEBHOOK_STRICT_REPOSITORY_ALLOWLIST`
    - `SCM_WEBHOOK_REQUIRE_DELIVERY_ID`
    - `SCM_WEBHOOK_DELIVERY_TTL_SECONDS`

### Infrastructure as Code (Terraform)
- Status: IN PROGRESS (Phase 1 bootstrap)
- Behavior implemented:
  - New IaC base under `infrastructure/terraform/`.
  - Provider-agnostic compute contract module added at
    `infrastructure/terraform/modules/compute-instance-contract`.
  - Reusable Lightsail module in `infrastructure/terraform/modules/lightsail-instance` with:
    - `aws_lightsail_instance`
    - `aws_lightsail_instance_public_ports`
    - optional static IP + attachment resources
    - public ports and static IP attachment are now force-replaced when instance identity changes, avoiding drift after same-name instance recreation.
  - First runnable environment stack in `infrastructure/terraform/environments/development` now consumes the compute contract.
  - Development stack supports automatic Lightsail SSH key-pair creation from a local public key path (`ssh_public_key_path`) and wires it into instance provisioning.
  - Optional `user_data` bootstrap script wiring for first-boot host configuration.
  - Bootstrap now supports a dedicated unprivileged deploy user with SSH public-key authentication and rootless Docker setup (fallback to `docker` group if rootless install fails).
  - Reserved provider contract value `gcp_compute_engine` is defined, but fails fast until implementation is added.
  - Operational guide in `infrastructure/terraform/README.md`.
  - Runtime stack scaffold added in `infrastructure/deploy/runtime` (Docker Compose + Nginx + Certbot flow).
  - Terraform remote state for development is configured through HCP Terraform (`cloud` block, workspace `darkneiss/aisentinel`).
  - Terraform GitHub Actions workflows are in place for development infra:
    - `terraform-plan.yml` (PR plan),
    - `terraform-apply.yml` (main/manual apply),
    - `terraform-destroy.yml` (manual destroy with explicit confirmation).

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
  - Global AI temperature override is available via `AI_TEMPERATURE` (used when prompt config does not set temperature).
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
  - AI triage processing decisions are now centralized in domain via
    `issue-ai-triage-processing-policy.service.ts`:
    - action support skip/continue result,
    - parsing success vs fail-open result,
    - explicit fail-open result for unhandled errors.
  - AI triage now also uses an explicit domain workflow
    (`issue-ai-triage-workflow.service.ts`) for:
    - start decision (continue vs unsupported),
    - post-LLM decision (apply governance vs fail-open),
    - unhandled-failure fail-open output.

## 4. Repository Context Enrichment
- New port: `RepositoryContextGateway`.
- Adapter: `GithubRepositoryContextAdapter`.
- Domain contract:
  - `features/triage/domain/ports/repository-context-reader.port.ts`.
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
  - Architecture guard-rails validate hexagonal boundaries for both relative and
    `src/...` absolute imports.
- Current quality gate:
  - `pnpm --filter api lint`: passing
  - `pnpm --filter api test`: passing
  - `pnpm --filter api architecture:check`: passing
  - Coverage currently at 100% (statements, branches, functions, lines) for `apps/api`.
  - Domain policy coverage includes:
    - `issue-webhook-processing-policy.service.ts`
    - `issue-ai-triage-processing-policy.service.ts`
  - Hexagonal guard rails are enforced by test:
    - `tests/features/triage/architecture/triage-hexagonal-boundaries.test.ts`
  - Dedicated architecture tool:
    - `src/tools/architecture/triage-architecture-check.tool.ts`
    - emits JSON coupling/change-surface metrics by layer and fails on boundary violations.
  - CI now includes a dedicated `Architecture` job with explicit failure semantics.
  - CI now includes a dedicated `Docker Build` job to validate container buildability on PR/push.
  - CI now includes a dedicated `Workflow Lint` job (`actionlint`) for GitHub Actions validation.
  - Release automation now runs via `Release Please`:
    - workflows:
      - `.github/workflows/release.yml`
      - `.github/workflows/publish-image.yml`
    - behavior:
      - `release.yml` creates/updates Release PR and publishes tag + GitHub Release when merged.
      - release baseline is managed by manifest files:
        - `release-please-config.json` (package strategy + `bootstrap-sha`, path `apps/api` + `extra-files` for `apps/api/package.json`)
        - `.release-please-manifest.json` (tracked API version baseline at `apps/api`)
      - release automation is scoped to `apps/api` changes, so infrastructure-only changes do not bump API versions.
      - `publish-image.yml` is dispatched only when a release is created (no manual trigger path).
      - release dispatch uses retry/backoff and passes release metadata from Release Please outputs.
      - publish workflow validates payload format and release/tag/sha integrity before image publish.
      - third-party workflow actions are pinned to immutable SHAs.
  - API runtime version resolution supports manifest-based automation:
    - `API_VERSION_FILE` (if set) is resolved first by `api-version-config.service`.
    - Docker runtime sets `API_VERSION_FILE=/app/apps/api/package.json`,
      keeping startup/health version aligned with API release metadata without manual `.env` updates.
    - release Docker publication includes Trivy scan gate and BuildKit SBOM/provenance attestations.

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
- `docs/adr/ADR-006-triage-domain-processing-policies.md`
  - Documents centralization of triage processing decisions into domain policy services.
- `docs/adr/ADR-007-webhook-acl-and-hexagonal-guardrails.md`
  - Documents webhook anti-corruption mapper, webhook+AI domain workflows, domain ports realignment, and boundary tests.
- `docs/adr/ADR-008-architecture-quality-gate-and-layer-metrics.md`
  - Documents dedicated architecture CLI checks, CI architecture gate, and layer drift metrics.
- `docs/adr/ADR-009-release-automation-with-release-please.md`
  - Documents automated version/changelog/tag/GitHub Release flow using Release Please.
- `docs/adr/README.md`
  - ADR index.
