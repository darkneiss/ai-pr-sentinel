import { IssueEntity } from '../../../../src/features/triage/domain/entities/issue.entity';
import {
  decideIssueWebhookWorkflow,
  type DecideIssueWebhookWorkflowInput,
} from '../../../../src/features/triage/domain/services/issue-webhook-workflow.service';
import type { IssueIntegrityValidator } from '../../../../src/features/triage/domain/services/issue-validation.service';

const createInput = (overrides: Partial<DecideIssueWebhookWorkflowInput> = {}): DecideIssueWebhookWorkflowInput => ({
  action: 'opened',
  repositoryFullName: 'org/repo',
  issue: {
    number: 42,
    title: 'Bug in login flow',
    body: 'App crashes on login from Safari private mode.',
    author: 'dev_user',
    labels: [],
  },
  ...overrides,
});

describe('IssueWebhookWorkflowService', () => {
  it('should short-circuit with 204 when action is unsupported', () => {
    // Arrange
    const input = createInput({
      action: 'deleted',
      repositoryFullName: 'invalid-repository-name',
      issue: {
        number: 3.5,
        title: 'x',
        body: 'x',
        author: 'dev_user',
        labels: [],
      },
    });

    // Act
    const result = decideIssueWebhookWorkflow(input);

    // Assert
    expect(result).toEqual({
      statusCode: 204,
      shouldSkipProcessing: true,
      shouldRunAiTriage: false,
      reason: 'unsupported_action',
      issueWebhookIdentity: null,
      governancePlan: null,
      issueForValidation: null,
    });
  });

  it('should short-circuit with 204 when issue identity is malformed for supported action', () => {
    // Arrange
    const input = createInput({
      repositoryFullName: 'invalid-repository-name',
      issue: {
        number: 3.5,
        title: 'x',
        body: 'x',
        author: 'dev_user',
        labels: [],
      },
    });

    // Act
    const result = decideIssueWebhookWorkflow(input);

    // Assert
    expect(result.statusCode).toBe(204);
    expect(result.reason).toBe('malformed_issue_identity');
    expect(result.issueWebhookIdentity).toBeNull();
    expect(result.governancePlan).toBeNull();
    expect(result.issueForValidation).toBeNull();
  });

  it('should return identity, domain issue and governance plan for supported valid input', () => {
    // Arrange
    const issueIntegrityValidator: jest.MockedFunction<IssueIntegrityValidator> = jest
      .fn()
      .mockReturnValue({
        isValid: true,
        errors: [],
      });
    const input = createInput({
      action: 'edited',
      issue: {
        number: 42,
        title: 'Bug in login flow when network drops',
        body: 'Steps to reproduce and observed logs...',
        author: 'dev_user',
        labels: ['triage/needs-info'],
      },
    });

    // Act
    const result = decideIssueWebhookWorkflow({
      ...input,
      issueIntegrityValidator,
    });

    // Assert
    expect(result.statusCode).toBe(200);
    expect(result.shouldSkipProcessing).toBe(false);
    expect(result.reason).toBeNull();
    expect(result.issueWebhookIdentity).toEqual({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      issueId: 'org/repo#42',
    });
    expect(result.issueForValidation).toBeInstanceOf(IssueEntity);
    expect(result.governancePlan?.shouldRunAiTriage).toBe(true);
  });
});
