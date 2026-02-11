# ADR-005: Webhook Ingress Hardening (Allowlist + Delivery Idempotency)

- Status: Accepted
- Date: 2026-02-11

## Context

GitHub webhook requests were validated by HMAC signature (`x-hub-signature-256`) but lacked:

1. Delivery-level replay protection (`X-GitHub-Delivery` deduplication).
2. Repository authorization controls (allowlist of accepted repositories).

This allowed functional replay and potential cross-repository execution risk when shared secrets/tokens are used.

## Decision

Implement ingress hardening at controller boundary before use-case execution:

1. **Repository authorization policy**
   - New application port: `RepositoryAuthorizationGateway`.
   - Infrastructure adapter: static allowlist adapter based on config.
   - Controller returns `403` when repository is not allowed.

2. **Webhook delivery idempotency**
   - New application port: `WebhookDeliveryGateway`.
   - Infrastructure adapter: in-memory TTL dedup store (`deliveryId` + source).
   - Controller returns `200` with `{ "status": "duplicate_ignored" }` for duplicates.
   - Configurable strict mode for missing `X-GitHub-Delivery`.

3. **Composition wiring**
   - New ingress config resolver:
     - `GITHUB_WEBHOOK_ALLOWED_REPOSITORIES`
     - `GITHUB_WEBHOOK_STRICT_REPOSITORY_ALLOWLIST`
     - `GITHUB_WEBHOOK_REQUIRE_DELIVERY_ID`
     - `GITHUB_WEBHOOK_DELIVERY_TTL_SECONDS`

## Consequences

### Positive

- Replay of identical deliveries is blocked before business logic execution.
- Requests from non-authorized repositories are rejected early.
- Changes preserve hexagonal boundaries by introducing explicit application ports.

### Tradeoffs

- In-memory dedup is process-local and does not cover multi-instance deployments.
- Missing delivery id in non-strict mode logs warnings and still processes.

### Follow-up

- Add Redis/Postgres adapter for `WebhookDeliveryGateway` with atomic insert-if-not-exists semantics.
- Add delivery duplication metrics/alerts for operational monitoring.
