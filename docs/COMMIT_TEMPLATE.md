# Commit Template

Use this template for consistent Conventional Commits and traceable validation.

## Subject

`<type>(<scope>): <short summary>`

Allowed `type` values:
- `feat`
- `fix`
- `test`
- `refactor`
- `docs`
- `chore`

Example:
`feat(api): enrich ai triage with repository context`

## Body Template

```text
Context:
- Why this change is needed.

Changes:
- What was added/updated.
- Key files or modules affected.

Validation:
- Commands executed.
- Relevant result summary (lint/tests/coverage).
```

## Optional Footer

```text
Refs: #issue-number
```

## Local Setup (optional but recommended)

```bash
git config commit.template docs/COMMIT_TEMPLATE.md
```
