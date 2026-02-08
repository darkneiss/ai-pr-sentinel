import { processIssueWebhook } from '../../../../src/features/triage/application/use-cases/process-issue-webhook.use-case';
import type { GovernanceGateway } from '../../../../src/features/triage/application/ports/governance-gateway.port';
import type { IssueIntegrityValidator } from '../../../../src/features/triage/domain/services/issue-validation.service';
import type { AnalyzeIssueWithAiInput, AnalyzeIssueWithAiResult } from '../../../../src/features/triage/application/use-cases/analyze-issue-with-ai.use-case';

const REPO_FULL_NAME = 'org/repo';
const ISSUE_NUMBER = 42;

const createGatewayMock = (): jest.Mocked<GovernanceGateway> => ({
  addLabels: jest.fn().mockResolvedValue(undefined),
  removeLabel: jest.fn().mockResolvedValue(undefined),
  createComment: jest.fn().mockResolvedValue(undefined),
  logValidatedIssue: jest.fn().mockResolvedValue(undefined),
});

const createAiAnalyzerMock = (): jest.MockedFunction<
  (input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>
> => jest.fn().mockResolvedValue({ status: 'completed' });

describe('ProcessIssueWebhookUseCase', () => {
  it('should apply invalid issue governance actions when validator returns invalid', async () => {
    // Arrange
    const governanceGateway = createGatewayMock();
    const analyzeIssueWithAi = createAiAnalyzerMock();
    const issueIntegrityValidator: jest.MockedFunction<IssueIntegrityValidator> = jest
      .fn()
      .mockReturnValue({
        isValid: false,
        errors: ['Title is required'],
      });

    const run = processIssueWebhook({
      governanceGateway,
      issueIntegrityValidator,
      analyzeIssueWithAi,
    });

    // Act
    const result = await run({
      action: 'opened',
      repositoryFullName: REPO_FULL_NAME,
      issue: {
        number: ISSUE_NUMBER,
        title: 'bug',
        body: 'short',
        author: 'dev_user',
        labels: [],
      },
    });

    // Assert
    expect(result).toEqual({ statusCode: 200 });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: REPO_FULL_NAME,
      issueNumber: ISSUE_NUMBER,
      labels: ['triage/needs-info'],
    });
    expect(governanceGateway.createComment).toHaveBeenCalledTimes(1);
    expect(governanceGateway.logValidatedIssue).not.toHaveBeenCalled();
    expect(analyzeIssueWithAi).not.toHaveBeenCalled();
    expect(issueIntegrityValidator).toHaveBeenCalledWith({
      id: `${REPO_FULL_NAME}#${ISSUE_NUMBER}`,
      title: 'bug',
      description: 'short',
      author: 'dev_user',
      createdAt: expect.any(Date),
    });
  });

  it('should apply valid issue governance actions when validator returns valid', async () => {
    // Arrange
    const governanceGateway = createGatewayMock();
    const analyzeIssueWithAi = createAiAnalyzerMock();
    const issueIntegrityValidator: jest.MockedFunction<IssueIntegrityValidator> = jest
      .fn()
      .mockReturnValue({
        isValid: true,
        errors: [],
      });

    const run = processIssueWebhook({
      governanceGateway,
      issueIntegrityValidator,
      analyzeIssueWithAi,
    });

    // Act
    const result = await run({
      action: 'edited',
      repositoryFullName: REPO_FULL_NAME,
      issue: {
        number: ISSUE_NUMBER,
        title: 'Bug in login flow when network drops',
        body: 'Steps to reproduce: open app, disable network, submit login form, and check observed crash logs.',
        author: 'dev_user',
        labels: ['invalid'],
      },
    });

    // Assert
    expect(result).toEqual({ statusCode: 200 });
    expect(governanceGateway.removeLabel).toHaveBeenCalledWith({
      repositoryFullName: REPO_FULL_NAME,
      issueNumber: ISSUE_NUMBER,
      label: 'invalid',
    });
    expect(governanceGateway.logValidatedIssue).toHaveBeenCalledWith({
      repositoryFullName: REPO_FULL_NAME,
      issueNumber: ISSUE_NUMBER,
    });
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(issueIntegrityValidator).toHaveBeenCalledTimes(1);
    expect(analyzeIssueWithAi).toHaveBeenCalledWith({
      action: 'edited',
      repositoryFullName: REPO_FULL_NAME,
      issue: {
        number: ISSUE_NUMBER,
        title: 'Bug in login flow when network drops',
        body: 'Steps to reproduce: open app, disable network, submit login form, and check observed crash logs.',
        labels: ['invalid'],
      },
    });
  });

  it('should ignore non-supported actions without running validation or governance actions', async () => {
    // Arrange
    const governanceGateway = createGatewayMock();
    const analyzeIssueWithAi = createAiAnalyzerMock();
    const issueIntegrityValidator: jest.MockedFunction<IssueIntegrityValidator> = jest
      .fn()
      .mockReturnValue({
        isValid: true,
        errors: [],
      });
    const run = processIssueWebhook({
      governanceGateway,
      issueIntegrityValidator,
      analyzeIssueWithAi,
    });

    // Act
    const result = await run({
      action: 'deleted',
      repositoryFullName: REPO_FULL_NAME,
      issue: {
        number: ISSUE_NUMBER,
        title: 'any',
        body: 'any',
        author: 'dev_user',
        labels: [],
      },
    });

    // Assert
    expect(result).toEqual({ statusCode: 204 });
    expect(issueIntegrityValidator).not.toHaveBeenCalled();
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(governanceGateway.removeLabel).not.toHaveBeenCalled();
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
    expect(governanceGateway.logValidatedIssue).not.toHaveBeenCalled();
    expect(analyzeIssueWithAi).not.toHaveBeenCalled();
  });

  it('should continue and return 200 when ai analyzer throws unexpectedly', async () => {
    // Arrange
    const governanceGateway = createGatewayMock();
    const issueIntegrityValidator: jest.MockedFunction<IssueIntegrityValidator> = jest
      .fn()
      .mockReturnValue({
        isValid: true,
        errors: [],
      });
    const analyzeIssueWithAi = jest
      .fn<Promise<AnalyzeIssueWithAiResult>, [AnalyzeIssueWithAiInput]>()
      .mockRejectedValue(new Error('ai-step-crashed'));
    const logger = {
      error: jest.fn(),
    };
    const run = processIssueWebhook({
      governanceGateway,
      issueIntegrityValidator,
      analyzeIssueWithAi,
      logger,
    });

    // Act
    const result = await run({
      action: 'opened',
      repositoryFullName: REPO_FULL_NAME,
      issue: {
        number: ISSUE_NUMBER,
        title: 'Bug in login flow when network drops',
        body: 'Steps to reproduce: open app, disable network, submit login form, and check observed crash logs.',
        author: 'dev_user',
        labels: [],
      },
    });

    // Assert
    expect(result).toEqual({ statusCode: 200 });
    expect(governanceGateway.logValidatedIssue).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('should not repeat invalid issue actions when triage/needs-info label already exists', async () => {
    // Arrange
    const governanceGateway = createGatewayMock();
    const issueIntegrityValidator: jest.MockedFunction<IssueIntegrityValidator> = jest
      .fn()
      .mockReturnValue({
        isValid: false,
        errors: ['Description is required'],
      });
    const run = processIssueWebhook({
      governanceGateway,
      issueIntegrityValidator,
    });

    // Act
    const result = await run({
      action: 'edited',
      repositoryFullName: REPO_FULL_NAME,
      issue: {
        number: ISSUE_NUMBER,
        title: 'Bug in login flow',
        body: '',
        author: 'dev_user',
        labels: ['triage/needs-info'],
      },
    });

    // Assert
    expect(result).toEqual({ statusCode: 200 });
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
    expect(governanceGateway.logValidatedIssue).not.toHaveBeenCalled();
  });
});
