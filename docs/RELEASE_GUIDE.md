# Release Guide

This project uses **Release Please** and publishes Docker images to **GHCR** using a chained two-workflow flow.

## Workflow files

1. `.github/workflows/release.yml`
2. `.github/workflows/publish-image.yml`

## Versioning behavior

Release Please follows Conventional Commits and SemVer:

1. **Major** (`X+1.0.0`)
   * Any breaking change (`feat!`, `fix!`, `refactor!`, or `BREAKING CHANGE:` footer).
2. **Minor** (`X.Y+1.0`)
   * At least one `feat:` and no breaking change.
3. **Patch** (`X.Y.Z+1`)
   * `fix:`/`deps:` style releasable changes and no `feat:`/breaking change.

There is no extra pre-1.0 guardrail configured in Release Please.

## How the release workflow runs

Trigger:

1. `CI` completes successfully for a `push` to `main`/`master` (`release.yml` via `workflow_run`)
2. Release job dispatches `publish-image.yml` only when a release is actually created
3. `publish-image.yml` is not manually triggerable (`workflow_dispatch` disabled)

Steps:

1. **Step 1 - Analyze commits and manage the Release PR**
   * Release Please updates/creates the Release PR.
   * When that Release PR is merged, it creates tag + GitHub Release.
2. **Step 2 - Report published release metadata**
   * Runs only when a release is created in that execution.
3. **Step 2b - Report Release PR update mode**
   * Runs when no release is published.
4. **Step 3 (release workflow) - Dispatch publish workflow**
   * Runs only when a release is created.
   * Sends `tag_name`, `version`, and release commit `sha` (from Release Please output) to `publish-image.yml`.
   * Uses retry with backoff when calling `repository_dispatch`.
5. **Step 1..11 (publish-image workflow) - Publish Docker image to GHCR**
   * Validates payload format and consistency (`tag_name`, `version`, `sha`).
   * Verifies release/tag/sha integrity before build/push.
   * Build once and push by digest (no release tags yet) with BuildKit attestations enabled.
   * Scan that exact pushed digest with Trivy and fail on HIGH/CRITICAL vulnerabilities.
   * If scan passes, promote the scanned digest to release tags without rebuilding.
   * Publishes:
     * `ghcr.io/<owner>/ai-pr-sentinel-api:vX.Y.Z`
     * `ghcr.io/<owner>/ai-pr-sentinel-api:X.Y.Z`
     * `ghcr.io/<owner>/ai-pr-sentinel-api:latest`
   * Also emits:
     * image digest
     * SBOM attestation
     * provenance attestation

## Normal operating sequence

1. Merge regular PRs into `main`.
2. CI succeeds on `main`.
3. Release workflow updates/creates Release PR.
4. Review and merge Release PR.
5. Release workflow publishes tag + GitHub Release and triggers publish workflow.
6. Publish workflow builds/scans/promotes the Docker image.

## Prerequisites

1. Use Conventional Commits.
2. Keep CI green before merging Release PRs.
3. Keep Dockerfile dependencies patched to pass Trivy scan gate.
4. Keep GitHub Action SHAs updated intentionally (workflows are pinned to immutable commits).
