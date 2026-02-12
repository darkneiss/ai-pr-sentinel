import { buildIssueIdentity } from './issue-identity-policy.service';
import { IssueNumber } from '../value-objects/issue-number.value-object';
import { RepositoryFullName } from '../value-objects/repository-full-name.value-object';

export interface ParseIssueWebhookIdentityInput {
  repositoryFullName: unknown;
  issueNumber: unknown;
}

export interface IssueWebhookIdentity {
  repositoryFullName: string;
  issueNumber: number;
  issueId: string;
}

export const isValidRepositoryFullName = (value: unknown): boolean =>
  RepositoryFullName.fromUnknown(value) !== null;

export const isValidIssueNumber = (value: unknown): boolean => IssueNumber.fromUnknown(value) !== null;

export const parseIssueWebhookIdentity = ({
  repositoryFullName,
  issueNumber,
}: ParseIssueWebhookIdentityInput): IssueWebhookIdentity | null => {
  const parsedRepositoryFullName = RepositoryFullName.fromUnknown(repositoryFullName);
  const parsedIssueNumber = IssueNumber.fromUnknown(issueNumber);

  if (!parsedRepositoryFullName || !parsedIssueNumber) {
    return null;
  }

  return {
    repositoryFullName: parsedRepositoryFullName.value,
    issueNumber: parsedIssueNumber.value,
    issueId: buildIssueIdentity({
      repositoryFullName: parsedRepositoryFullName.value,
      issueNumber: parsedIssueNumber.value,
    }).value,
  };
};
