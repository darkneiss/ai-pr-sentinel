# Specification 001: Issue Governance and Automatic Triage

## 1. Executive Summary
The system acts as an automated quality gate. Whenever an Issue is created or edited, Sentinel analyzes its content to ensure it meets minimum information standards before involving the human team.

## 2. Business Rules (Domain Rules)

### BR-01: Title Integrity
- **Goal:** Avoid vague titles such as "help", "error", or "bug".
- **Logic:**
  - Must exist (not null or empty).
  - Minimum length: **10 characters**.
  - Must not contain only generic words (blacklist: "bug", "error", "issue", "help").

### BR-02: Description Integrity
- **Goal:** Ensure enough context to reproduce the issue.
- **Logic:**
  - Must exist.
  - Minimum length: **30 characters**.
  - (Future scope) Should include key sections like "Steps to reproduce" (out of current scope).

### BR-03: Author Identity
- **Logic:** The author must be identified (not `null`).

## 3. System Behavior (Flow)

### Scenario A: Invalid Issue (Validation Failure)
When a violation of BR-01 or BR-02 is detected:
1. **Action 1 (Label):** Add label `triage/needs-info` or `invalid`.
2. **Action 2 (Comment):** Post an automatic comment listing the detected errors.
3. **Action 3 (State):** (Optional) Do not close the issue automatically, but alert the user.

### Scenario B: Valid Issue (Happy Path)
1. **Action:** If previous error labels exist (`invalid`), remove them.
2. **Log:** Register internally that the issue passed the filter.

## 4. API and Events (Infrastructure)

### Trigger: GitHub Webhooks
The system must listen to:
- `issues.opened`
- `issues.edited`

### Expected Payload (Simplified)
```json
{
  "action": "opened",
  "issue": {
    "number": 12,
    "title": "Bug in login",
    "body": "It crashes.",
    "user": {
      "login": "dev_user"
    }
  },
  "repository": {
    "full_name": "org/repo"
  }
}
```

## 5. Technical Implementation (Hexagonal)
- Domain: `Issue` (Entity), `IssueValidationService` (Domain Service).
- Application: `ValidateIssueUseCase` (Orchestrator).
- Infrastructure: `GithubWebhookController` (input), `GithubRestAdapter` (output for comments/labels).
