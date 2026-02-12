import { IssueEntity } from '../../../../src/features/triage/domain/entities/issue.entity';
import {
  buildIssueValidationComment,
  decideIssueGovernanceActions,
} from '../../../../src/features/triage/domain/services/issue-governance-policy.service';

const TRIAGE_NEEDS_INFO_LABEL = 'triage/needs-info';
const GOVERNANCE_ERROR_LABELS = ['triage/needs-info', 'triage/spam'] as const;

describe('IssueGovernancePolicyService', () => {
  it('should request needs-info actions when issue is invalid and label is missing', () => {
    // Arrange
    const issue = IssueEntity.create({
      id: 'org/repo#1',
      title: 'short',
      description: 'tiny',
      author: 'dev_user',
      createdAt: new Date('2026-02-11T12:00:00.000Z'),
    });
    const validation = issue.validateIntegrity();

    // Act
    const result = decideIssueGovernanceActions({
      validation,
      existingLabels: [],
      governanceErrorLabels: [...GOVERNANCE_ERROR_LABELS],
      needsInfoLabel: TRIAGE_NEEDS_INFO_LABEL,
    });

    // Assert
    expect(result).toEqual({
      shouldAddNeedsInfoLabel: true,
      shouldCreateValidationComment: true,
      shouldLogValidatedIssue: false,
      shouldRunAiTriage: false,
      labelsToRemove: [],
      validationErrors: validation.errors,
    });
  });

  it('should skip repeated needs-info actions when issue is invalid and label already exists', () => {
    // Arrange
    const issue = IssueEntity.create({
      id: 'org/repo#2',
      title: 'short',
      description: 'tiny',
      author: 'dev_user',
      createdAt: new Date('2026-02-11T12:00:00.000Z'),
    });
    const validation = issue.validateIntegrity();

    // Act
    const result = decideIssueGovernanceActions({
      validation,
      existingLabels: [TRIAGE_NEEDS_INFO_LABEL],
      governanceErrorLabels: [...GOVERNANCE_ERROR_LABELS],
      needsInfoLabel: TRIAGE_NEEDS_INFO_LABEL,
    });

    // Assert
    expect(result).toEqual({
      shouldAddNeedsInfoLabel: false,
      shouldCreateValidationComment: false,
      shouldLogValidatedIssue: false,
      shouldRunAiTriage: false,
      labelsToRemove: [],
      validationErrors: validation.errors,
    });
  });

  it('should request cleanup and validated logging when issue is valid', () => {
    // Arrange
    const issue = IssueEntity.create({
      id: 'org/repo#3',
      title: 'Bug in login flow when network drops',
      description:
        'Steps to reproduce: open app, disable network, submit login form, and check observed crash logs.',
      author: 'dev_user',
      createdAt: new Date('2026-02-11T12:00:00.000Z'),
    });
    const validation = issue.validateIntegrity();

    // Act
    const result = decideIssueGovernanceActions({
      validation,
      existingLabels: ['kind/bug', 'triage/spam'],
      governanceErrorLabels: [...GOVERNANCE_ERROR_LABELS],
      needsInfoLabel: TRIAGE_NEEDS_INFO_LABEL,
    });

    // Assert
    expect(result).toEqual({
      shouldAddNeedsInfoLabel: false,
      shouldCreateValidationComment: false,
      shouldLogValidatedIssue: true,
      shouldRunAiTriage: true,
      labelsToRemove: ['triage/spam'],
      validationErrors: [],
    });
  });

  it('should build validation comment body from validation errors', () => {
    // Arrange
    const validationErrors = ['Title is too short (min 10 chars)', 'Author is required'];

    // Act
    const result = buildIssueValidationComment(validationErrors);

    // Assert
    expect(result).toBe(
      'Issue validation failed. Please fix the following items:\n- Title is too short (min 10 chars)\n- Author is required',
    );
  });
});
