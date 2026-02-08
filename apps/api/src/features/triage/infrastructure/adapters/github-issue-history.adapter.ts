import { Octokit } from '@octokit/rest';

import type { IssueHistoryGateway, RecentIssueSummary } from '../../application/ports/issue-history-gateway.port';
import { parseRepositoryRef } from './github-repository-ref.util';

const GITHUB_TOKEN_ENV_VAR = 'GITHUB_TOKEN';
const LOG_CONTEXT = 'GithubIssueHistoryAdapter';

interface Logger {
  error: (message: string, ...args: unknown[]) => void;
}

interface CreateGithubIssueHistoryAdapterParams {
  githubToken?: string;
  octokit?: Octokit;
  logger?: Logger;
}

interface GithubIssueLabelObject {
  name?: string | null;
}

interface GithubIssueListItem {
  number: number;
  title: string;
  state: 'open' | 'closed';
  labels: Array<GithubIssueLabelObject | string>;
  pull_request?: Record<string, unknown>;
}

interface GithubIssueCommentItem {
  body?: string | null;
  user?: {
    login?: string | null;
  };
}

const createOctokitClient = (params: CreateGithubIssueHistoryAdapterParams): Octokit => {
  if (params.octokit) {
    return params.octokit;
  }

  const githubToken = params.githubToken ?? process.env[GITHUB_TOKEN_ENV_VAR];
  if (!githubToken) {
    throw new Error(`Missing GitHub token. Provide "githubToken" or set ${GITHUB_TOKEN_ENV_VAR}`);
  }

  return new Octokit({ auth: githubToken });
};

const isPullRequestItem = (issue: GithubIssueListItem): boolean => !!issue.pull_request;

const mapLabelName = (label: GithubIssueLabelObject | string): string | undefined => {
  if (typeof label === 'string') {
    return label;
  }

  if (typeof label.name === 'string' && label.name.length > 0) {
    return label.name;
  }

  return undefined;
};

const mapIssueToRecentSummary = (issue: GithubIssueListItem): RecentIssueSummary => ({
  number: issue.number,
  title: issue.title,
  state: issue.state,
  labels: issue.labels
    .map((label) => mapLabelName(label))
    .filter((labelName): labelName is string => !!labelName),
});

export const createGithubIssueHistoryAdapter = (
  params: CreateGithubIssueHistoryAdapterParams = {},
): IssueHistoryGateway => {
  const octokit = createOctokitClient(params);
  const logger = params.logger ?? console;

  return {
    findRecentIssues: async ({ repositoryFullName, limit }) => {
      const repository = parseRepositoryRef(repositoryFullName);

      try {
        const response = await octokit.issues.listForRepo({
          owner: repository.owner,
          repo: repository.repo,
          state: 'open',
          sort: 'created',
          direction: 'desc',
          per_page: limit,
          page: 1,
        });

        return (response.data as unknown as GithubIssueListItem[])
          .filter((issue) => !isPullRequestItem(issue))
          .map((issue) => mapIssueToRecentSummary(issue));
      } catch (error: unknown) {
        logger.error(`${LOG_CONTEXT} failed fetching recent issues`, {
          repositoryFullName,
          limit,
          error,
        });
        throw error;
      }
    },
    hasIssueCommentWithPrefix: async ({ repositoryFullName, issueNumber, bodyPrefix, authorLogin }) => {
      const repository = parseRepositoryRef(repositoryFullName);

      try {
        const response = await octokit.issues.listComments({
          owner: repository.owner,
          repo: repository.repo,
          issue_number: issueNumber,
          per_page: 100,
          page: 1,
        });

        const comments = response.data as unknown as GithubIssueCommentItem[];
        return comments.some((comment) => {
          const commentBody = comment.body ?? '';
          const hasPrefix = commentBody.startsWith(bodyPrefix);
          if (!hasPrefix) {
            return false;
          }

          if (!authorLogin) {
            return true;
          }

          return comment.user?.login === authorLogin;
        });
      } catch (error: unknown) {
        logger.error(`${LOG_CONTEXT} failed fetching issue comments`, {
          repositoryFullName,
          issueNumber,
          bodyPrefix,
          authorLogin,
          error,
        });
        throw error;
      }
    },
  };
};
