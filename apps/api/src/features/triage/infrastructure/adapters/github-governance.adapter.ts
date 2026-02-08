import { Octokit } from '@octokit/rest';

import type { GovernanceGateway } from '../../application/ports/governance-gateway.port';

const REPOSITORY_SEPARATOR = '/';
const REPOSITORY_PARTS_COUNT = 2;
const GITHUB_TOKEN_ENV_VAR = 'GITHUB_TOKEN';
const LABEL_NOT_FOUND_STATUS = 404;
const LOG_CONTEXT = 'GithubGovernanceAdapter';

interface RepositoryRef {
  owner: string;
  repo: string;
}

interface Logger {
  info: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

interface CreateGithubGovernanceAdapterParams {
  githubToken?: string;
  octokit?: Octokit;
  logger?: Logger;
}

interface ErrorWithStatus {
  status?: number;
}

const isErrorWithStatus = (error: unknown): error is ErrorWithStatus =>
  !!error && typeof error === 'object' && 'status' in error;

const parseRepositoryRef = (repositoryFullName: string): RepositoryRef => {
  const repositoryParts = repositoryFullName.split(REPOSITORY_SEPARATOR);
  const [owner, repo] = repositoryParts;
  const isInvalidRepository =
    repositoryParts.length !== REPOSITORY_PARTS_COUNT || !owner || !repo;

  if (isInvalidRepository) {
    throw new Error(`Invalid repository full name: "${repositoryFullName}"`);
  }

  return { owner, repo };
};

const createOctokitClient = (params: CreateGithubGovernanceAdapterParams): Octokit => {
  if (params.octokit) {
    return params.octokit;
  }

  const githubToken = params.githubToken ?? process.env[GITHUB_TOKEN_ENV_VAR];
  if (!githubToken) {
    throw new Error(`Missing GitHub token. Provide "githubToken" or set ${GITHUB_TOKEN_ENV_VAR}`);
  }

  return new Octokit({ auth: githubToken });
};

export const createGithubGovernanceAdapter = (
  params: CreateGithubGovernanceAdapterParams = {},
): GovernanceGateway => {
  const octokit = createOctokitClient(params);
  const logger = params.logger ?? console;

  return {
    addLabels: async ({ repositoryFullName, issueNumber, labels }) => {
      const repository = parseRepositoryRef(repositoryFullName);

      try {
        await octokit.issues.addLabels({
          owner: repository.owner,
          repo: repository.repo,
          issue_number: issueNumber,
          labels,
        });
      } catch (error: unknown) {
        logger.error(`${LOG_CONTEXT} failed adding labels`, {
          repositoryFullName,
          issueNumber,
          labels,
          error,
        });
        throw error;
      }
    },

    removeLabel: async ({ repositoryFullName, issueNumber, label }) => {
      const repository = parseRepositoryRef(repositoryFullName);

      try {
        await octokit.issues.removeLabel({
          owner: repository.owner,
          repo: repository.repo,
          issue_number: issueNumber,
          name: label,
        });
      } catch (error: unknown) {
        if (isErrorWithStatus(error) && error.status === LABEL_NOT_FOUND_STATUS) {
          logger.info(`${LOG_CONTEXT} label not found while removing label`, {
            repositoryFullName,
            issueNumber,
            label,
          });
          return;
        }

        logger.error(`${LOG_CONTEXT} failed removing label`, {
          repositoryFullName,
          issueNumber,
          label,
          error,
        });
        throw error;
      }
    },

    createComment: async ({ repositoryFullName, issueNumber, body }) => {
      const repository = parseRepositoryRef(repositoryFullName);

      try {
        await octokit.issues.createComment({
          owner: repository.owner,
          repo: repository.repo,
          issue_number: issueNumber,
          body,
        });
      } catch (error: unknown) {
        logger.error(`${LOG_CONTEXT} failed creating comment`, {
          repositoryFullName,
          issueNumber,
          error,
        });
        throw error;
      }
    },

    logValidatedIssue: async ({ repositoryFullName, issueNumber }) => {
      logger.info(`${LOG_CONTEXT} issue passed governance validation`, {
        repositoryFullName,
        issueNumber,
      });
    },
  };
};
