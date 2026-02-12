# ADR-008: Dedicated Architecture Quality Gate and Layer Metrics

- Date: 2026-02-12
- Status: Accepted

## Context

Hexagonal boundaries in triage were already protected by unit tests, but hardening opportunities remained:

- Boundary validation was coupled to Jest-only execution.
- CI lacked an explicit architecture job with clear ownership/failure semantics.
- There was no deterministic metric output to track coupling/change-surface drift by layer over time.

## Decision

1. Introduce a dedicated architecture tool:
   - `src/tools/architecture/triage-architecture-check.tool.ts`
   - Enforces layer rules:
     - `domain` must not import `application` or `infrastructure`
     - `application` must not import `infrastructure`

2. Add explicit layer metrics emitted as JSON:
   - Coupling per layer:
     - internal import count
     - import distribution to `domain`, `application`, `infrastructure`, `external`
   - Change-surface per layer:
     - file count
     - import count
     - average imports per file

3. Wire a dedicated CI job:
   - New `architecture` job in `.github/workflows/ci.yml`
   - Runs `pnpm --filter api architecture:check`
   - Fails explicitly when architecture violations are detected.

## Consequences

Positive:

- Architecture checks are executable outside Jest and can be integrated in CI/CD or local scripts.
- Failure ownership in CI is explicit via a dedicated `Architecture` job.
- Layer metrics are available for drift monitoring and governance dashboards.

Trade-offs:

- Additional maintenance for the tool and its import resolution logic.
- Metrics are structural proxies and should be complemented with trend analysis tooling.
