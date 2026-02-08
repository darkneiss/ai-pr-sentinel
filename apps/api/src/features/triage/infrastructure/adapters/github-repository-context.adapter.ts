import { Octokit } from '@octokit/rest';

import type { RepositoryContextGateway } from '../../application/ports/repository-context-gateway.port';

const REPOSITORY_SEPARATOR = '/';
const REPOSITORY_PARTS_COUNT = 2;
const GITHUB_TOKEN_ENV_VAR = 'GITHUB_TOKEN';
const README_NOT_FOUND_STATUS = 404;
const README_FORBIDDEN_STATUS = 403;
const LOG_CONTEXT = 'GithubRepositoryContextAdapter';

interface RepositoryRef {
  owner: string;
  repo: string;
}

interface Logger {
  debug?: (message: string, ...args: unknown[]) => void;
  info?: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

interface CreateGithubRepositoryContextAdapterParams {
  githubToken?: string;
  octokit?: Octokit;
  logger?: Logger;
}

interface ErrorWithStatus {
  status?: number;
}

interface ReadmeResponseData {
  content?: string;
  encoding?: string;
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

const createOctokitClient = (params: CreateGithubRepositoryContextAdapterParams): Octokit => {
  if (params.octokit) {
    return params.octokit;
  }

  const githubToken = params.githubToken ?? process.env[GITHUB_TOKEN_ENV_VAR];
  if (!githubToken) {
    throw new Error(`Missing GitHub token. Provide "githubToken" or set ${GITHUB_TOKEN_ENV_VAR}`);
  }

  return new Octokit({ auth: githubToken });
};

const decodeReadmeContent = (data: ReadmeResponseData): string | undefined => {
  if (typeof data.content !== 'string' || data.content.length === 0) {
    return undefined;
  }

  if (data.encoding !== 'base64') {
    return undefined;
  }

  return Buffer.from(data.content, 'base64').toString('utf8').trim();
};

export const createGithubRepositoryContextAdapter = (
  params: CreateGithubRepositoryContextAdapterParams = {},
): RepositoryContextGateway => {
  const octokit = createOctokitClient(params);
  const logger = params.logger ?? console;

  return {
    findRepositoryContext: async ({ repositoryFullName }) => {
      const repository = parseRepositoryRef(repositoryFullName);

      try {
        const response = await octokit.repos.getReadme({
          owner: repository.owner,
          repo: repository.repo,
        });

        const decodedReadme = decodeReadmeContent(response.data as ReadmeResponseData);
        return {
          readme: decodedReadme,
        };
      } catch (error: unknown) {
        if (isErrorWithStatus(error) && error.status === README_NOT_FOUND_STATUS) {
          logger.info?.(`${LOG_CONTEXT} README not found`, {
            repositoryFullName,
          });
          return {};
        }

        if (isErrorWithStatus(error) && error.status === README_FORBIDDEN_STATUS) {
          logger.info?.(`${LOG_CONTEXT} README access forbidden. Continuing without repository context.`, {
            repositoryFullName,
          });
          return {};
        }

        logger.error(`${LOG_CONTEXT} failed fetching README`, {
          repositoryFullName,
          error,
        });
        throw error;
      }
    },
  };
};
