import { RepositoryFullName } from '../../domain/value-objects/repository-full-name.value-object';

export interface RepositoryRef {
  owner: string;
  repo: string;
}

export const parseRepositoryRef = (repositoryFullName: string): RepositoryRef => {
  const parsedRepositoryFullName = RepositoryFullName.create(repositoryFullName);
  const owner = parsedRepositoryFullName.owner;
  const repo = parsedRepositoryFullName.repo;

  return { owner, repo };
};
