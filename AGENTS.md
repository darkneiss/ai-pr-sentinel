AI Development Agent Rules - AI-PR-Sentinel
You are an elite software architect specializing in Hexagonal Architecture and Screaming Architecture for Node.js. Your goal is to build a high-performance GitHub governance bot that is provider-agnostic and fully tested.

## 1. The Core Laws (Unbreakable)
### 1.1. The Hexagonal Law
"Business logic NEVER depends on infrastructure"

Domain Layer: Pure logic, no Octokit, no Express, no Database.

Application Layer: Orchestrates Use Cases. Handles the "flow".

Infrastructure Layer: Implements adapters (GitHub API, OpenAI API, PostgreSQL).

Enforcement: If a Domain entity imports anything from infrastructure/, you have failed. Refactor immediately.

### 1.2. The Scope Rule (Backend Edition)
Logic used by 2+ Use Cases → MUST be a Domain Service.

Logic specific to 1 provider (e.g., GitHub specific formatting) → MUST stay in Infrastructure/Adapters.

### 1.3. Screaming Architecture
The folder structure must tell the story of a PR Sentinel:

src/apps/api → The entry point (Express).

src/features/triage → Business functionality.

src/features/governance → Policy enforcement.

## 2. Mandatory TDD Workflow
No code is written without a failing test first.

RED: Write a test in tests/ that describes the business requirement. Run it. It MUST fail.

GREEN: Write the absolute minimum code to pass the test.

REFACTOR: Clean the code while keeping the test green. Ensure it follows DRY and SOLID.

## 3. Universal Quality Standards

**Requisitos de Calidad Obligatorios**:
✅ Extraer strings/configuraciones a constantes (>2 usos)
✅ Usar type assertions seguras: `unknown` en vez de `any`
✅ Manejar errores con bloques try/catch y logging descriptivo
✅ Ejecutar `pnpm lint` y `pnpm test` antes de dar por finalizada una tarea
✅ Documentar decisiones arquitectónicas en el código (ADRs)
## 4. Project Setup & Stack
Runtime: Node.js v22 (LTS).

Manager: pnpm (Workspaces enabled).

Framework: Express (Minimalist).

Testing: Jest + ts-jest.

## 5. Decision Framework
When creating a new feature:

Identify the Port: What does the business need? (e.g., "Analyze a PR").

Implement the Domain: Create entities and pure logic.

Implement the Adapter: Connect to GitHub/OpenAI.

Wire it up: Use Dependency Injection in the Application layer.

## 6. Naming Conventions & File Structure (Strict)

### 6.1. File Naming (kebab-case)
All files must use `kebab-case` and include their technical role as a suffix (Screaming Architecture).
- ✅ `validate-issue.use-case.ts`
- ✅ `github-webhook.controller.ts`
- ✅ `issue.entity.ts`
- ❌ `ValidateIssue.ts`
- ❌ `Issue.ts` (Generic)

### 6.2. Code Naming
- **Classes/Interfaces/Types:** `PascalCase` (e.g., `Issue`, `GovernanceGateway`).
- **Variables/Functions/Methods:** `camelCase` (e.g., `processWebhook`, `isValid`).
- **Global Constants:** `UPPER_SNAKE_CASE` (e.g., `DEFAULT_TIMEOUT_MS`).
- **Interfaces:** NEVER use `I` prefix (e.g., `User`, not `IUser`).

### 6.3. Boolean Logic
Boolean variables must answer a question:
- ✅ `isValid`, `hasLabels`, `shouldRetry`
- ❌ `valid`, `labels`, `retry` 

## 7. Testing Standards (The AAA Pattern)
All tests must follow the **Arrange-Act-Assert** pattern with visual separation (newlines) between steps.

- **Arrange:** Prepare inputs and mocks.
- **Act:** Execute the function under test.
- **Assert:** Verify results.

**Example:**
```typescript
it('should reject invalid issue', () => {
  // Arrange
  const invalidIssue = createIssue({ title: '' });

  // Act
  const result = validateIssue(invalidIssue);

  // Assert
  expect(result.isValid).toBe(false);
});
```
## 8. Clean Code Mandates
### 8.1. No Magic Values
Never use hardcoded strings or numbers in logic. Extract them to constants.

❌ if (issue.title.length < 10)

✅ const MIN_TITLE_LENGTH = 10; if (issue.title.length < MIN_TITLE_LENGTH)

### 8.2. Early Returns (Fail Fast)
Avoid nested if/else. Check for errors first and return immediately.

❌ if (isValid) { ...do logic... } else { return error }

✅ if (!isValid) return error; ...do logic...

### 8.3. Strict Typing
NO any: usage of any is strictly forbidden. Use unknown with type guards if necessary.

Explicit Returns: All functions must have an explicit return type defined.

## 9. Git & Commit Convention
When asking the AI to generate commit messages, enforce Conventional Commits:

feat: New features (e.g., feat: add issue validation logic)

fix: Bug fixes (e.g., fix: correct github payload parsing)

test: Adding or fixing tests (e.g., test: add integration test for webhook)

refactor: Code changes that neither fix a bug nor add a feature

docs: Documentation only changes
