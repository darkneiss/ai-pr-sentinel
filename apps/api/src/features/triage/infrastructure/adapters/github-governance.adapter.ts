import { Octokit } from '@octokit/rest';

import type { GovernanceGateway } from '../../application/ports/governance-gateway.port';

const REPOSITORY_SEPARATOR = '/';
const REPOSITORY_PARTS_COUNT = 2;
const GITHUB_TOKEN_ENV_VAR = 'GITHUB_TOKEN';
const LABEL_NOT_FOUND_STATUS = 404;
const FORBIDDEN_STATUS = 403;
const UNPROCESSABLE_ENTITY_STATUS = 422;
const LOG_CONTEXT = 'GithubGovernanceAdapter';
const GITHUB_WRITE_PERMISSION_HINT =
  'Check GITHUB_TOKEN permissions. Required scopes: repo (classic) or Issues: write (fine-grained).';

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

const getErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error) {
    return error.message;
  }

  return undefined;
};

const getResponseMessage = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return undefined;
  }

  const response = (error as { response?: unknown }).response;
  if (!response || typeof response !== 'object' || !('data' in response)) {
    return undefined;
  }

  const data = (response as { data?: unknown }).data;
  if (!data || typeof data !== 'object' || !('message' in data)) {
    return undefined;
  }

  const message = (data as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
};

const getErrorSuggestion = (status: number | undefined): string | undefined => {
  if (status === FORBIDDEN_STATUS) {
    return GITHUB_WRITE_PERMISSION_HINT;
  }

  if (status === UNPROCESSABLE_ENTITY_STATUS) {
    return 'GitHub rejected the label payload. Confirm labels are valid and token can manage labels in this repository.';
  }

  return undefined;
};

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
        const githubStatus = isErrorWithStatus(error) ? error.status : undefined;
        const errorMessage = getErrorMessage(error);
        const githubResponseMessage = getResponseMessage(error);
        const suggestion = getErrorSuggestion(githubStatus);

        logger.error(`${LOG_CONTEXT} failed adding labels`, {
          repositoryFullName,
          issueNumber,
          labels,
          githubStatus,
          errorMessage,
          githubResponseMessage,
          suggestion,
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
