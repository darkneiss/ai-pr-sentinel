# ADR-001: LLM Integration Strategy (No LangChain, No Provider SDKs in MVP)

- Status: Accepted
- Date: 2026-02-08
- Deciders: AI-PR-Sentinel team
- Related spec: `docs/specs/002-issue-ai.md`

## Context
The project needs a provider-agnostic AI triage pipeline for GitHub issues (OpenAI, Gemini, Ollama/local models).  
The architecture is strict hexagonal, with business logic isolated from infrastructure details.

## Decision
For the MVP, we implement provider adapters with direct HTTP mapping behind `LLMGateway` and **do not** use:
- orchestration frameworks like LangChain
- official provider SDKs inside core triage flow

## Rationale
1. Provider-agnostic consistency:
   - A single internal contract (`LLMGateway.generateJson`) keeps application logic independent from vendor SDK APIs.
2. Hexagonal boundary clarity:
   - Adapters remain thin and explicit; no framework abstractions leak into application/domain.
3. Deterministic behavior:
   - We control payload shape, timeouts, retries, and JSON normalization explicitly.
4. Testability:
   - HTTP payload/response mapping is easy to unit-test with mocks and fixtures.
5. Dependency risk reduction:
   - Fewer transitive dependencies and fewer breaking changes from SDK/framework upgrades.
6. Cost and observability control:
   - Request/response handling stays explicit and auditable for governance workflows.

## Consequences
### Positive
- Clear, auditable adapters per provider.
- Lower coupling to external libraries.
- Simpler failure-mode handling (fail-open) and response normalization.

### Negative
- More maintenance effort in adapters when providers change API details.
- Some convenience features from SDK/frameworks are not available by default.

## Rejected Alternatives
1. LangChain orchestration:
   - Rejected for MVP due to additional abstraction layer, higher dependency surface, and less explicit control for strict governance workflows.
2. Official provider SDKs as primary integration:
   - Rejected for MVP to keep one stable internal contract and avoid SDK-specific coupling.

## Revisit Criteria
We may adopt LangChain and/or provider SDKs if:
- multi-step agent workflows become necessary,
- adapter maintenance cost exceeds current approach,
- and we can preserve hexagonal boundaries via infrastructure-only wrappers.

