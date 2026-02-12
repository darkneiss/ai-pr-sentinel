# ADR-006: Triage Domain Processing Policies

- Date: 2026-02-12
- Status: Accepted

## Context

Use-cases in `features/triage/application/use-cases` accumulated conditional branches
that represented business decisions, not only orchestration:

- Whether a webhook action should be processed or skipped.
- Whether malformed webhook identity inputs should be fail-open skipped.
- Whether AI triage should return `completed` or fail-open `ai_unavailable`.

These decisions were previously embedded in application flow control, increasing
knowledge leakage from domain rules into orchestrators.

## Decision

Centralize triage processing decisions in explicit domain policy services and keep
application use-cases as orchestration-only:

- `issue-webhook-processing-policy.service.ts`
  - Decides skip/continue for webhook processing.
  - Guards malformed identity construction for supported actions with deterministic skip.
- `issue-ai-triage-processing-policy.service.ts`
  - Decides skip/continue for AI triage action support.
  - Decides result status for parsed vs unavailable AI analysis.
  - Provides explicit fail-open result for unhandled processing failures.

Additionally, domain-level contracts were introduced under `domain/ports` and reused by
application ports for issue history and repository context access.

## Consequences

Positive:

- Better DDD tactical separation: business policies live in domain services.
- Use-cases are simpler and focused on sequencing gateways/adapters.
- Fail-open behavior is deterministic and testable at domain level.
- Reduced risk of behavioral regressions from flow refactors in application.

Trade-offs:

- More policy functions/types to maintain.
- Developers must preserve policy-first flow when adding new triage behaviors.
