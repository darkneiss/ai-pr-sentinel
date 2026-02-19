# DDD Context Map

This document defines the current bounded contexts and integration rules for the API codebase.

## Bounded Contexts

### `triage` (Core Domain)
- Purpose: classify, prioritize, and govern issue triage actions.
- Owns:
  - issue validation and triage policies
  - AI triage action planning
  - issue webhook workflow decisions
- Location: `apps/api/src/features/triage`

### `governance` (Planned Context)
- Purpose: cross-repository governance policies and policy orchestration that are not triage-specific.
- Current status: planned and reserved in the model; when introduced it must follow the same hexagonal layering.

## Shared Kernel

The following folders are shared across contexts:
- `apps/api/src/shared/*`
- `apps/api/src/infrastructure/composition/*` (composition root only, not domain logic)

Shared kernel must contain reusable contracts, low-level adapters/utilities, and neutral abstractions. Context-specific business rules must stay inside their context domain.

## Context Integration Rules

1. `domain` must not import `application` or `infrastructure`.
2. `application` must not import `infrastructure`.
3. Feature contexts under `apps/api/src/features/*` must not import each other directly.
4. Cross-context reuse is allowed only through:
   - `shared` contracts/services, or
   - explicit anti-corruption mapping in the receiving context.

## Operational Enforcement

- Architecture boundaries and cross-context isolation are checked by:
  - `pnpm --filter api architecture:check`
- DDD tactical/strategic controls are checked by:
  - `pnpm --filter api ddd:check`
