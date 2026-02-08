const REPOSITORY_SEPARATOR = '/';
const REPOSITORY_PARTS_COUNT = 2;

export interface RepositoryRef {
  owner: string;
  repo: string;
}

export const parseRepositoryRef = (repositoryFullName: string): RepositoryRef => {
  const repositoryParts = repositoryFullName.split(REPOSITORY_SEPARATOR);
  const [owner, repo] = repositoryParts;
  const isInvalidRepository =
    repositoryParts.length !== REPOSITORY_PARTS_COUNT || !owner || !repo;

  if (isInvalidRepository) {
    throw new Error(`Invalid repository full name: "${repositoryFullName}"`);
  }

  return { owner, repo };
};
