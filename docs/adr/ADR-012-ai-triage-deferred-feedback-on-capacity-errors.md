# ADR-012: AI Triage Deferred Feedback on Provider Capacity Errors

- Date: 2026-02-21
- Status: Accepted

## Context

AI triage follows fail-open behavior to avoid blocking issue processing when the LLM provider is unavailable.
Before this decision, provider capacity failures (rate-limit/quota) were logged, but the issue itself had no explicit state that communicated triage was deferred.
This created a visibility gap for maintainers and contributors because an unprocessed issue looked identical to a successfully triaged one.

## Decision

1. Detect provider capacity failures in the AI triage use case using conservative patterns:
   - HTTP 429 status
   - rate-limit related errors
   - quota exhaustion related errors

2. On detected capacity failure:
   - apply label `triage/ai-deferred` (idempotent),
   - publish an English bot comment explaining triage was deferred and should be retried by editing/reopening the issue (idempotent by comment prefix check).

3. On a later successful AI triage execution:
   - remove label `triage/ai-deferred` automatically.

4. Keep fail-open guarantees:
   - if deferred marker writes fail (GitHub API write error), triage still returns `skipped/ai_unavailable` and does not block webhook flow.

## Consequences

Positive:

- Deferred AI triage becomes visible directly in the issue timeline and labels.
- Maintainers get an explicit retry path without manual detective work.
- Idempotency is preserved across repeated webhook deliveries/events.

Trade-offs:

- One additional triage label is introduced in repository governance taxonomy.
- Error-pattern matching is heuristic and may require adjustment if provider error formats change.
