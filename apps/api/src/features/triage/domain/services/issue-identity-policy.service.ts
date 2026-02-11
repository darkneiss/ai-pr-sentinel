import { IssueId } from '../value-objects/issue-id.value-object';
import { IssueNumber } from '../value-objects/issue-number.value-object';
import { RepositoryFullName } from '../value-objects/repository-full-name.value-object';

const ISSUE_ID_SEPARATOR = '#';

export interface BuildIssueIdentityInput {
  repositoryFullName: string;
  issueNumber: number;
}

export const buildIssueIdentity = ({ repositoryFullName, issueNumber }: BuildIssueIdentityInput): IssueId => {
  const normalizedRepositoryFullName = RepositoryFullName.create(repositoryFullName);
  const normalizedIssueNumber = IssueNumber.create(issueNumber);

  return IssueId.create(`${normalizedRepositoryFullName.value}${ISSUE_ID_SEPARATOR}${normalizedIssueNumber.value}`);
};
