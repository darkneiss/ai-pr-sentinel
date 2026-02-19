# ADR-011: DDD Control Score Gate

- Date: 2026-02-19
- Status: Accepted

## Context

Hexagonal boundary checks were already enforced, but DDD compliance discussion remained mostly qualitative.
The project needed an objective, repeatable control to:

- track tactical DDD signals (use-cases, domain model presence, boundary compliance),
- track strategic DDD signals (explicit context map and cross-context isolation),
- fail CI when minimum governance thresholds are not met.

## Decision

1. Add a dedicated DDD control tool:
   - `apps/api/src/tools/architecture/ddd-control-check.tool.ts`
   - command: `pnpm --filter api ddd:check`

2. Emit a structured report with:
   - `scores`: `strategic`, `tactical`, `global`
   - `thresholds`: configurable via env
   - `findings`: strategic and tactical finding codes
   - `metrics`: context coverage and violation counters

3. Default threshold policy:
   - strategic: `100`
   - tactical: `80`
   - global: `85`
   - overrides:
     - `DDD_MIN_STRATEGIC_SCORE`
     - `DDD_MIN_TACTICAL_SCORE`
     - `DDD_MIN_GLOBAL_SCORE`

4. Enforce in CI with a dedicated job in `.github/workflows/ci.yml`.

5. Create and maintain explicit context map documentation:
   - `docs/ddd/context-map.md`

## Consequences

Positive:

- DDD enforcement moves from subjective review to measurable gate.
- CI can reject architectural drift early.
- Context-map documentation becomes operationally required.

Trade-offs:

- The score is a proxy, not a full semantic audit of domain modeling quality.
- Threshold tuning will be needed as more contexts are introduced.
