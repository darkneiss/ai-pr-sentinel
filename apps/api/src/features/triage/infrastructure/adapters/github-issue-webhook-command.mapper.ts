import type { ProcessIssueWebhookInput } from '../../application/use-cases/process-issue-webhook.use-case';
import {
  isValidIssueNumber,
  isValidRepositoryFullName,
} from '../../domain/services/issue-webhook-identity-policy.service';

interface GithubIssueLabel {
  name: string;
}

export interface GithubIssueWebhookPayload {
  action: string;
  issue: {
    number: number;
    title: string;
    body: string | null;
    user: {
      login: string;
    };
    labels: GithubIssueLabel[];
  };
  repository: {
    full_name: string;
  };
}

const isGithubIssueWebhookPayload = (value: unknown): value is GithubIssueWebhookPayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;
  const issue = payload.issue as Record<string, unknown> | undefined;
  const repository = payload.repository as Record<string, unknown> | undefined;
  const user = issue?.user as Record<string, unknown> | undefined;
  const labels = issue?.labels;

  return (
    typeof payload.action === 'string' &&
    !!issue &&
    typeof issue.number === 'number' &&
    isValidIssueNumber(issue.number) &&
    typeof issue.title === 'string' &&
    (typeof issue.body === 'string' || issue.body === null) &&
    !!user &&
    typeof user.login === 'string' &&
    Array.isArray(labels) &&
    labels.every(
      (label) =>
        !!label &&
        typeof label === 'object' &&
        typeof (label as Record<string, unknown>).name === 'string',
    ) &&
    !!repository &&
    typeof repository.full_name === 'string' &&
    isValidRepositoryFullName(repository.full_name)
  );
};

export const mapGithubIssueWebhookToProcessCommand = (value: unknown): ProcessIssueWebhookInput | null => {
  if (!isGithubIssueWebhookPayload(value)) {
    return null;
  }

  return {
    action: value.action,
    repositoryFullName: value.repository.full_name,
    issue: {
      number: value.issue.number,
      title: value.issue.title,
      body: value.issue.body ?? '',
      author: value.issue.user.login,
      labels: value.issue.labels.map((label) => label.name),
    },
  };
};
