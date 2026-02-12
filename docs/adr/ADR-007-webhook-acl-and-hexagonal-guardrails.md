# ADR-007: Webhook ACL + Domain Workflow + Hexagonal Guardrails

- Date: 2026-02-12
- Status: Accepted

## Context

The triage webhook path still had orchestration details mixed with payload adaptation and
action execution branching:

- Controller-level payload-to-command mapping lived inline.
- `process-issue-webhook` use-case still encoded workflow and per-action execution details.
- Architectural boundaries (domain/application/infrastructure imports) were not enforced by tests.

## Decision

1. Introduce a dedicated anti-corruption mapper for GitHub webhook payloads:
   - `github-issue-webhook-command.mapper.ts`
   - Controller now receives `unknown`, maps to a process command, and only then invokes use-case.

2. Introduce an explicit domain workflow for webhook triage:
   - `issue-webhook-workflow.service.ts`
   - Centralizes processing decision + identity resolution + domain issue creation + governance plan derivation.

3. Reduce decision leakage in use-case action execution:
   - Added `apply-issue-webhook-governance-actions.service.ts`
   - `process-issue-webhook.use-case.ts` now orchestrates workflow output + action executor.

4. Move additional contracts into `domain/ports` and make application ports adapters/facades:
   - `issue-governance-writer.port.ts`
   - `repository-authorization-reader.port.ts`
   - `webhook-delivery-registry.port.ts`

5. Add architectural guard-rails as executable tests:
   - `triage-hexagonal-boundaries.test.ts`
   - Enforces:
     - domain must not import application/infrastructure
     - application must not import infrastructure

## Consequences

Positive:

- Cleaner hexagonal boundaries and reduced coupling in webhook ingress flow.
- Use-case now mostly orchestrates and delegates business decisions to domain services.
- Port contracts better reflect core needs in domain-first terms.
- Boundary violations fail fast in CI via architecture tests.

Trade-offs:

- More files and abstractions to keep aligned.
- Boundary tests rely on import-path conventions and should be maintained if structure changes.
