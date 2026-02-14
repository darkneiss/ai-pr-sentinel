# AI-PR-Sentinel 🛡️

> **Automated Governance & Triage Bot for GitHub Repositories**
>
> *Master's Thesis Project (TFM) - Backend Architecture & AI Integration*

![Node.js](https://img.shields.io/badge/Node.js-v22-green)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)
![Architecture](https://img.shields.io/badge/Architecture-Hexagonal-orange)
![Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen)

## 📋 Overview

**AI-PR-Sentinel** acts as an intelligent gatekeeper for software projects. It listens to GitHub events (Issues, PRs) and enforces governance policies automatically.

Unlike standard linters, this system understands **context** and **business rules**, applying "Governance as Code" principles to ensure repository hygiene before a human ever needs to intervene.

## 🏗️ Architecture

This project is built following **Hexagonal Architecture (Ports & Adapters)** and **Screaming Architecture** so business logic stays independent from frameworks and external tools.

```mermaid
graph TD
    EXT[SCM Webhook\nGitHub today] --> APP[createApp + createHttpApp\nInfrastructure Composition Root]
    APP --> REG[ScmProviderIntegrationRegistry\nresolve route + factories]
    REG --> CTRL[GithubWebhookController]

    CTRL --> SEC[Ingress controls\nsignature + allowlist + delivery dedup]
    SEC --> MAP[github-issue-webhook-command.mapper\nAnti-Corruption Layer]

    subgraph HEX["Hexagon (Domain + Application)"]
        PWH[processIssueWebhook\nApplication Use Case]
        DWF[issue-webhook-workflow\nDomain Service]
        PWH --> DWF
    end

    MAP --> PWH
    PWH -.port.-> GOVP[GovernanceGateway]
    PWH -.port.-> AIRP[IssueAiTriageRunner (optional)]

    AIRP --> LAZYAI[lazy-ai-triage-runner.factory]
    LAZYAI --> AIA[analyzeIssueWithAi\nApplication Use Case]
    AIA --> AIWF[issue-ai-triage-workflow + action plans\nDomain Services]
    AIA -.port.-> LLMP[LLMGateway]
    AIA -.port.-> HISTP[IssueHistoryGateway]
    AIA -.port.-> REPOP[RepositoryContextGateway]
    AIA -.port.-> GOVP

    GOVP --> GOVAD[github-governance.adapter]
    HISTP --> HISTAD[github-issue-history.adapter]
    REPOP --> REPOAD[github-repository-context.adapter]
    LLMP --> LLMAD[Gemini / Groq / Ollama adapters]

    GOVAD --> GHAPI[GitHub API]
    HISTAD --> GHAPI
    REPOAD --> GHAPI
    LLMAD --> LLMAPI[LLM Provider APIs]
```
## 🚀 Tech Stack
Runtime: Node.js v22 + pnpm Workspaces

Framework: Express (Minimalist Web Server)

Language: TypeScript (Strict Mode)

Testing: Jest + Supertest (TDD Approach)

Patterns: DDD, Hexagonal Architecture, Dependency Injection

## 🛠️ Project Structure
```bash
.
├── apps/
│   └── api/
│       ├── src/
│       │   ├── features/
│       │   │   └── triage/
│       │   │       ├── domain/           # Entities, value objects, domain services, domain ports
│       │   │       ├── application/      # Use cases, app services, app ports
│       │   │       └── infrastructure/   # Feature adapters and controllers
│       │   ├── infrastructure/
│       │   │   ├── composition/          # Composition root, provider wiring, config resolution
│       │   │   └── http/                 # Express app factory
│       │   ├── shared/                   # Shared kernel (ports, prompts, observability, logging, config)
│       │   └── tools/architecture/       # Architecture quality gate tool
│       └── tests/                        # Unit, integration, architecture, fixtures
├── infrastructure/
│   ├── apps/api/docker/                  # Dockerfile and container docs
│   └── scripts/                          # Monorepo infrastructure scripts (build, push, tunnel)
├── docs/
│   ├── adr/                              # Architecture Decision Records
│   └── specs/                            # Functional specs
├── .github/workflows/                    # CI and release workflows
├── docker-compose.yml                    # Local container orchestration
└── package.json                          # Workspace root scripts and metadata
```
## ⚡ Quick Start
### Prerequisites
- Node.js v22+

- pnpm (npm install -g pnpm)

## Installation
```Bash
# Clone repository
git clone git@github.com:darkneiss/ai-pr-sentinel.git

# Change directory
cd AI-PR-Sentinel

# Node version
nvm use
# Install dependencies
pnpm install

# Run Tests (The Holy Grail)
pnpm test
```
## 🔧 Environment
Create the API environment file and configure the LLM provider:

```Bash
cd apps/api
cp .env.example .env
```

See the setup guide for provider-specific `LLM_BASE_URL` rules:
- [Setup Guide](./docs/SETUP_GUIDE.md)

## 🧪 Quality Assurance
This project follows strict TDD (Test Driven Development) protocols.

- Unit Tests: For Domain Logic (Fast, isolated).

- Integration Tests: For Controllers and Adapters.

Run the quality gate:

```Bash
pnpm quality
```
## 📜 Documentation
- [Governance Rules](./docs/specs/001-issue-governance.md)
- [Architecture Decisions (ADRs)](./docs/adr/README.md)
- [Setup Guide](./docs/SETUP_GUIDE.md)
- [LangSmith Observability](./docs/LANGSMITH_OBSERVABILITY.md)
- [Prompt Registry & Versioning](./docs/PROMPT_REGISTRY.md)

- [Agent Rules & Conventions](AGENTS.md)

- [Commit Template](./docs/COMMIT_TEMPLATE.md)
