import {
  buildIssueWebhookGovernancePlan,
  type IssueWebhookGovernancePlan,
} from '../../../../src/features/triage/domain/services/issue-webhook-governance-plan.service';
import type { IssueIntegrityValidationResult } from '../../../../src/features/triage/domain/entities/issue.entity';
import { IssueEntity } from '../../../../src/features/triage/domain/entities/issue.entity';
import { TRIAGE_NEEDS_INFO_LABEL } from '../../../../src/features/triage/application/constants/governance-labels.constants';

const GOVERNANCE_ERROR_LABELS = ['triage/needs-info', 'triage/invalid'] as const;
const VALIDATION_ERROR = 'Title is too short (minimum 10 characters)';

const createIssueEntity = (): IssueEntity =>
  IssueEntity.create({
    id: 'org/repo#42',
    title: 'Valid issue title',
    description: 'This is a valid issue description with enough details.',
    author: 'jordi',
    createdAt: new Date('2026-02-12T00:00:00.000Z'),
  });

const createValidationResult = (isValid: boolean): IssueIntegrityValidationResult => ({
  isValid,
  errors: isValid ? [] : [VALIDATION_ERROR],
});

describe('buildIssueWebhookGovernancePlan', () => {
  it('should skip unsupported webhook actions', () => {
    // Arrange
    const issue = createIssueEntity();

    // Act
    const result = buildIssueWebhookGovernancePlan({
      action: 'closed',
      issue,
      existingLabels: [],
      governanceErrorLabels: GOVERNANCE_ERROR_LABELS,
      needsInfoLabel: TRIAGE_NEEDS_INFO_LABEL,
      issueIntegrityValidator: jest.fn(() => createValidationResult(true)),
    });

    // Assert
    const expected: IssueWebhookGovernancePlan = {
      shouldSkipProcessing: true,
      statusCode: 204,
      shouldAddNeedsInfoLabel: false,
      validationCommentBody: null,
      labelsToRemove: [],
      shouldLogValidatedIssue: false,
      shouldRunAiTriage: false,
    };
    expect(result).toEqual(expected);
  });

  it('should build invalid-governance actions when issue integrity is invalid', () => {
    // Arrange
    const issue = createIssueEntity();
    const issueIntegrityValidator = jest.fn(() => createValidationResult(false));

    // Act
    const result = buildIssueWebhookGovernancePlan({
      action: 'opened',
      issue,
      existingLabels: [],
      governanceErrorLabels: GOVERNANCE_ERROR_LABELS,
      needsInfoLabel: TRIAGE_NEEDS_INFO_LABEL,
      issueIntegrityValidator,
    });

    // Assert
    expect(issueIntegrityValidator).toHaveBeenCalledTimes(1);
    expect(result.shouldSkipProcessing).toBe(false);
    expect(result.statusCode).toBe(200);
    expect(result.shouldAddNeedsInfoLabel).toBe(true);
    expect(result.validationCommentBody).toContain('Issue validation failed');
    expect(result.shouldLogValidatedIssue).toBe(false);
    expect(result.shouldRunAiTriage).toBe(false);
  });

  it('should build valid-governance actions when issue integrity is valid', () => {
    // Arrange
    const issue = createIssueEntity();
    const issueIntegrityValidator = jest.fn(() => createValidationResult(true));

    // Act
    const result = buildIssueWebhookGovernancePlan({
      action: 'edited',
      issue,
      existingLabels: ['triage/needs-info', 'kind/question'],
      governanceErrorLabels: GOVERNANCE_ERROR_LABELS,
      needsInfoLabel: TRIAGE_NEEDS_INFO_LABEL,
      issueIntegrityValidator,
    });

    // Assert
    expect(issueIntegrityValidator).toHaveBeenCalledTimes(1);
    expect(result.shouldSkipProcessing).toBe(false);
    expect(result.statusCode).toBe(200);
    expect(result.shouldAddNeedsInfoLabel).toBe(false);
    expect(result.validationCommentBody).toBeNull();
    expect(result.labelsToRemove).toEqual(['triage/needs-info']);
    expect(result.shouldLogValidatedIssue).toBe(true);
    expect(result.shouldRunAiTriage).toBe(true);
  });
});
