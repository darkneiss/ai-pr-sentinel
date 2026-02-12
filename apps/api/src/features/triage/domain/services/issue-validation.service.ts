import { IssueEntity, type Issue, type IssueIntegrityValidationResult } from '../entities/issue.entity';

export type ValidationResult = IssueIntegrityValidationResult;

export type IssueIntegrityValidator = (issue: Issue) => ValidationResult;

export const validateIssueIntegrity: IssueIntegrityValidator = (issue) => {
  const issueEntity = IssueEntity.from(issue);
  return issueEntity.validateIntegrity();
};
