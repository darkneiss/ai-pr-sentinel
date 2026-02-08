# 002: AI-Enhanced Issue Triage

| Field | Value |
| :--- | :--- |
| **Status** | Approved |
| **Date** | 2026-02-08 |
| **Feature** | AI Analysis for Issues |
| **Depends On** | 001-issue-governance |

## 1. Objective
Add an AI triage stage after deterministic validation to improve issue quality without blocking users when AI fails.

## 2. Scope
### In Scope (MVP)
- Semantic classification (`bug` | `feature` | `question`)
- Duplicate detection against recent open issues
- Tone detection (`positive` | `neutral` | `hostile`)
- Fail-open behavior when AI is unavailable

### Out of Scope (for this iteration)
- Automatic issue closing
- Embeddings/vector database
- Multi-language translation
- Human moderation workflow UI

## 3. Guardrail Flow
1. Webhook received (`issues.opened`, `issues.edited`).
2. Deterministic validation runs first.
3. If invalid: normal governance flow (`triage/needs-info`, comment), stop.
4. If valid: run AI triage use case.
5. If AI fails: log and continue without blocking (fail-open).

## 4. Architecture (Hexagonal)
- Domain:
  - `IssueAiTriageService` (pure decision logic)
  - AI result value objects and policies
- Application:
  - `analyze-issue-with-ai.use-case.ts` (orchestrates gateways)
- Infrastructure:
  - `openai-llm.adapter.ts` (or other providers)
  - `github-governance.adapter.ts` extended for recent issues read
- Shared:
  - LLM gateway port and shared AI DTOs

## 5. Ports and Contracts

### 5.1 `LLMGateway` (Shared Port)
```ts
export interface LLMGateway {
  generateJson(input: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens: number;
    timeoutMs: number;
    temperature?: number;
  }): Promise<{ rawText: string }>;
}
```

### 5.2 `GovernanceGateway` extension
```ts
export interface RecentIssueSummary {
  number: number;
  title: string;
  labels: string[];
  state: 'open' | 'closed';
}

export interface GovernanceGateway {
  addLabels(input: { repositoryFullName: string; issueNumber: number; labels: string[] }): Promise<void>;
  removeLabel(input: { repositoryFullName: string; issueNumber: number; label: string }): Promise<void>;
  createComment(input: { repositoryFullName: string; issueNumber: number; body: string }): Promise<void>;
  logValidatedIssue(input: { repositoryFullName: string; issueNumber: number }): Promise<void>;
  findRecentIssues(input: { repositoryFullName: string; limit: number }): Promise<RecentIssueSummary[]>;
}
```

### 5.3 AI output contracts (validated after parsing)
```ts
export type IssueKind = 'bug' | 'feature' | 'question';

export interface IssueClassificationResult {
  type: IssueKind;
  confidence: number; // 0..1
  reasoning: string;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  originalIssueNumber: number | null;
  similarityScore: number; // 0..1
}

export type ToneResult = 'positive' | 'neutral' | 'hostile';
```

## 6. Domain Policies and Config
All values must live in constants/config (no magic values).

```ts
export const AI_CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.8;
export const AI_DUPLICATE_SIMILARITY_THRESHOLD = 0.85;
export const AI_RECENT_ISSUES_LIMIT = 15;
export const AI_TIMEOUT_MS = 7000;
export const AI_MAX_TOKENS = 700;
export const AI_TEMPERATURE = 0.1;
```

## 7. Labels and Actions
Centralize labels in application constants.

```ts
export const TRIAGE_DUPLICATE_LABEL = 'triage/duplicate';
export const TRIAGE_MONITOR_LABEL = 'triage/monitor';
export const KIND_BUG_LABEL = 'kind/bug';
export const KIND_FEATURE_LABEL = 'kind/feature';
export const KIND_QUESTION_LABEL = 'kind/question';
```

Rules:
- If classification confidence >= threshold and type differs from current user labels:
  - Add detected `kind/*` label
  - Remove conflicting `kind/*` label if present
- If duplicate detection indicates duplicate and `similarityScore >= threshold`:
  - Add `triage/duplicate`
  - Comment `Possible duplicate of #<number>`
- If tone is `hostile`:
  - Add `triage/monitor`

## 8. Parsing, Validation and Fallback
- LLM response must be parsed from JSON with runtime guards.
- If parsing fails, missing fields, or values out of range:
  - Mark AI step as failed
  - Apply fail-open (no user-facing error)
  - Log structured error with context

## 9. Reliability and Cost Controls
- Timeout per LLM call: `AI_TIMEOUT_MS`
- Retries: max 1 retry only for transient errors (429/503/timeouts)
- Total AI budget per issue processing:
  - Max 3 LLM calls (classification, duplicates, tone)
  - If budget exceeded, skip remaining AI checks and fail-open
- Prompts must include only required fields:
  - `title`, `body`, minimal recent issue summaries
  - No author email, no extra PII

## 10. Security Controls
- Treat issue content as untrusted input.
- Prompt templates must isolate user content and avoid instruction override.
- Never execute instructions coming from issue text.
- Strip control characters before prompt construction.

## 11. Idempotency Rules
For repeated webhook deliveries or repeated edits:
- Do not post duplicate duplicate-comments for same `originalIssueNumber`.
- Do not re-add existing labels.
- Do not remove labels that are absent.

## 12. Observability
Minimum structured logs:
- `ai_triage_started`
- `ai_triage_completed`
- `ai_triage_failed`

Required fields:
- `repositoryFullName`, `issueNumber`, `step` (`classification|duplicate|tone`), `durationMs`, `status`, `provider`, `model`

## 13. Testing Strategy
### Domain tests
- Decision thresholds
- Invalid AI payload handling
- Label decision logic

### Application tests
- Orchestration with mocked gateways
- Fail-open path when AI gateway throws
- Idempotency behavior

### Infrastructure tests
- Adapter mapping to provider payload
- Gateway read method `findRecentIssues`
- Timeout and retry behavior

## 14. Acceptance Criteria (Definition of Done)
1. AI triage runs only when deterministic validation passes.
2. AI failure never returns HTTP 5xx to user for expected provider errors.
3. Classification relabeling works at confidence threshold.
4. Duplicate detection comments and labels as specified.
5. Hostile tone adds `triage/monitor`.
6. No duplicate comments/labels on repeated webhook events.
7. `pnpm lint` and `pnpm test` pass.
8. New code follows hexagonal boundaries and strict typing (`no any`).

## 15. Implementation Plan
1. Add shared `LLMGateway` port and AI DTO contracts.
2. Extend `GovernanceGateway` with `findRecentIssues` and adapter implementation.
3. Implement domain `IssueAiTriageService` with pure decision logic.
4. Implement `analyze-issue-with-ai.use-case.ts` and integrate into webhook flow after basic validation.
5. Add prompt templates and runtime JSON guards.
6. Add tests by layer (domain/application/infrastructure).
7. Validate quality gates and document ADR decisions.
