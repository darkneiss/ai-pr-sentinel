# OWASP Top 10 (2025) - Security Assessment

Date: 2026-02-21
Scope: `apps/api`, runtime edge (`infrastructure/deploy/runtime`), CI/CD workflows.

This document tracks security posture against OWASP Top 10 (2025), with concrete repository evidence and open gaps.

## Summary

| OWASP 2025 | Status | Notes |
|---|---|---|
| A01 - Broken Access Control | Partial | Signature + allowlist controls exist; production baseline hardening enforced in config. |
| A02 - Security Misconfiguration | Partial | Hardened Nginx + workflow preflights; secrets/vars model documented. |
| A03 - Software Supply Chain Failures | Partial | Dependabot + pinned actions + Trivy in image publish; open dependency alerts must be remediated. |
| A04 - Cryptographic Failures | Partial | HMAC SHA-256 signature verification + TLS 1.2/1.3; key lifecycle managed in GH secrets. |
| A05 - Injection | Partial | No SQL layer; strict payload mapping and route scoping; continue validating external payload boundaries. |
| A06 - Insecure Design | Partial | Hexagonal boundaries + ADRs + fail-open policy documented; threat scenarios still require periodic review. |
| A07 - Authentication Failures | Partial | Webhook authentication by signature; no end-user auth model (service is webhook-driven). |
| A08 - Software or Data Integrity Failures | Partial | Workflow integrity via pinned actions and release flow checks; no artifact signing/attestation verification gate yet. |
| A09 - Security Logging and Alerting Failures | Partial | Structured logs and error paths exist; alerting integration (SIEM/alerts) pending. |
| A10 - Mishandling of Exceptional Conditions | Partial | Explicit error handling + workflow preflight/smoke checks; resilience good but not yet chaos-tested. |

---

## A01 - Broken Access Control

### Implemented controls
- Repository allowlist gateway: `apps/api/src/features/triage/infrastructure/adapters/static-repository-authorization.adapter.ts`
- Delivery dedup gate and replay controls: `apps/api/src/features/triage/infrastructure/controllers/github-webhook.controller.ts`
- Production ingress security baseline enforced at config level:
  - `SCM_WEBHOOK_STRICT_REPOSITORY_ALLOWLIST=true`
  - `SCM_WEBHOOK_REQUIRE_DELIVERY_ID=true`
  - non-empty `SCM_WEBHOOK_ALLOWED_REPOSITORIES`
  - `apps/api/src/infrastructure/composition/webhook-ingress-config.service.ts`

### Remaining gap
- Multi-tenant/repo scenarios require explicit allowlist maintenance policy.

## A02 - Security Misconfiguration

### Implemented controls
- Nginx hardening and scanner blocking:
  - `infrastructure/deploy/runtime/nginx/conf.d/00-runtime-observability-and-hardening.conf`
  - `infrastructure/deploy/runtime/nginx/templates/site-tls.conf.template`
- Deploy preflight checks (runner + remote prerequisites):
  - `.github/workflows/deploy-runtime.yml`
- Operational runbook and secrets/vars guidance:
  - `docs/INFRASTRUCTURE_OPERATIONS_RUNBOOK.md`

### Remaining gap
- Periodic drift audit for runtime vars/secrets should be formalized.

## A03 - Software Supply Chain Failures

### Implemented controls
- Dependabot enabled: `.github/dependabot.yml`
- Actions pinned by commit SHA across workflows.
- Image vulnerability scan (Trivy) in publish pipeline:
  - `.github/workflows/publish-image.yml`
- CI production dependency audit gate:
  - `.github/workflows/ci.yml` (`dependency_audit` job)

### Remaining gap
- Repository still reports unresolved dependency vulnerabilities; they must be fixed before claiming full compliance.

## A04 - Cryptographic Failures

### Implemented controls
- Webhook signature verification using HMAC SHA-256 + timing-safe compare:
  - `apps/api/src/features/triage/infrastructure/controllers/github-webhook.controller.ts`
- Signature config fail-fast in production:
  - `apps/api/src/infrastructure/composition/webhook-signature-config.service.ts`
- TLS configuration with strong protocol baseline:
  - `infrastructure/deploy/runtime/nginx/templates/site-tls.conf.template`

### Remaining gap
- No formal key rotation runbook for webhook secrets and deploy credentials yet.

## A05 - Injection

### Implemented controls
- Strict payload mapping before use-case invocation:
  - `apps/api/src/features/triage/infrastructure/adapters/github-issue-webhook-command.mapper.ts`
- Limited exposed routes at edge:
  - `infrastructure/deploy/runtime/nginx/templates/site-http.conf.template`
  - `infrastructure/deploy/runtime/nginx/templates/site-tls.conf.template`

### Remaining gap
- Keep enforcing strict schema/shape guards when adding new endpoints/providers.

## A06 - Insecure Design

### Implemented controls
- Domain/Application/Infrastructure boundaries with architecture gates.
- ADR set covering webhook ingress hardening and composition decisions:
  - `docs/adr/ADR-005-webhook-ingress-hardening.md`
  - `docs/adr/ADR-007-webhook-acl-and-hexagonal-guardrails.md`

### Remaining gap
- Threat modeling sessions are not yet part of the regular release process.

## A07 - Authentication Failures

### Implemented controls
- Request authentication for webhook endpoint through provider signature.
- Production default enforcement for signature and ingress controls.

### Remaining gap
- If future public API endpoints are added, explicit authN/authZ design is required.

## A08 - Software or Data Integrity Failures

### Implemented controls
- Release-driven image publication pipeline with tag/SHA validation:
  - `.github/workflows/release.yml`
  - `.github/workflows/publish-image.yml`
- Runtime deploy uses immutable image tags per release.

### Remaining gap
- No mandatory verification of signed artifacts/attestations at deploy time yet.

## A09 - Security Logging and Alerting Failures

### Implemented controls
- Structured logs for webhook verification/rejection/error paths.
- LLM observability sanitation/redaction:
  - `apps/api/src/shared/infrastructure/observability/langsmith-observability.adapter.ts`

### Remaining gap
- Centralized alerting (e.g., repeated 401/403 spikes, webhook failures) is not automated yet.

## A10 - Mishandling of Exceptional Conditions

### Implemented controls
- Controller-level guarded exception handling and safe 500 responses:
  - `apps/api/src/features/triage/infrastructure/controllers/github-webhook.controller.ts`
- Deploy workflow resilience:
  - dispatch retries (`publish-image`)
  - preflight checks and post-deploy health check (`deploy-runtime`)

### Remaining gap
- No fault-injection/chaos test stage in CI/CD.

---

## Immediate Next Actions (High Impact)

1. Close unresolved dependency vulnerabilities (Dependabot security alerts).
2. Harden CI dependency audit handling for transient registry/network failures (for example `EAI_AGAIN`) while preserving hard-fail for real vulnerabilities.
3. Add key rotation procedure for webhook secret and deploy credentials.
4. Add alerting rules for repeated webhook auth failures and runtime health degradation.
