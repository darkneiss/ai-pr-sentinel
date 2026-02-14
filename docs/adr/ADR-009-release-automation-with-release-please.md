# ADR-009: Release Automation with Release Please

## Status

Accepted

## Context

The repository had CI checks for architecture, lint, and tests, but no standardized release pipeline to:

1. Calculate semantic versions consistently.
2. Generate release notes from commit history.
3. Publish tags and GitHub Releases in a predictable, auditable way.

Manual tagging and changelog edits increase drift risk and make release cadence harder to sustain.

## Decision

Adopt **Release Please** via GitHub Actions workflow:

1. Workflow files:
   * `.github/workflows/release.yml`
   * `.github/workflows/publish-image.yml`
2. Trigger/order:
   * `release.yml` runs only after `CI` succeeds on `main`/`master` (`workflow_run`).
   * `publish-image.yml` runs only when `release.yml` dispatches it after `release_created=true`.
3. Release strategy: `node` package at repository root (`package.json`).
4. Behavior:
   * On regular merges, create or update a Release PR with version/changelog changes.
   * When Release PR is merged, publish tag (`vX.Y.Z`) and GitHub Release automatically.
5. Release workflow dispatches publish workflow with release metadata (`tag_name`, `version`, `sha`).
6. Publish workflow builds container image once by digest, scans that exact digest with Trivy,
   and only then promotes it to release tags (`vX.Y.Z`, `X.Y.Z`, `latest`) without rebuilding.
7. Security hardening in workflows:
   * Third-party GitHub Actions are pinned to immutable commit SHAs.
   * `publish-image.yml` accepts only `repository_dispatch` (no manual trigger path).
   * Dispatch payload is schema-validated (`tag_name`, `version`, `sha`) before publish.
   * Publish workflow validates release/tag/sha integrity before building and pushing image.
   * Release-to-publish dispatch includes retry/backoff for transient API failures.

Operational usage details are documented in `docs/RELEASE_GUIDE.md`.

## Consequences

### Positive

1. Consistent SemVer from Conventional Commits.
2. Reproducible release metadata (tag + notes) without manual steps.
3. Release artifacts (GitHub Release + Docker image) are published in an ordered CI->Release->Publish chain.
4. Explicit ordering guarantees:
   * no release before CI success
   * no image publish before release creation
5. Supply-chain and orchestration integrity is improved with immutable action pinning and
   release metadata verification gates.

### Negative / Trade-offs

1. Commit message discipline becomes mandatory for correct versioning.
2. Maintainers must review and merge Release PRs as part of the process.
3. Docker publication currently targets GHCR (not Docker Hub) by default.
4. Orchestration complexity increases with two coordinated workflows and dispatch payloads.

## Follow-up

1. Consider adding artifact signing (e.g., cosign) as an additional publish gate.
