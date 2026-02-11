import type { RepositoryAuthorizationGateway } from '../../application/ports/repository-authorization-gateway.port';

interface CreateStaticRepositoryAuthorizationAdapterInput {
  allowedRepositories: string[];
  strictAllowlist: boolean;
}

const normalizeRepositoryFullName = (repositoryFullName: string): string => repositoryFullName.trim().toLowerCase();

export const createStaticRepositoryAuthorizationAdapter = ({
  allowedRepositories,
  strictAllowlist,
}: CreateStaticRepositoryAuthorizationAdapterInput): RepositoryAuthorizationGateway => {
  const normalizedAllowedRepositories = new Set(
    allowedRepositories.map((repositoryFullName) => normalizeRepositoryFullName(repositoryFullName)),
  );

  return {
    isAllowed: (repositoryFullName: string): boolean => {
      if (normalizedAllowedRepositories.size === 0) {
        return !strictAllowlist;
      }

      const normalizedRepositoryFullName = normalizeRepositoryFullName(repositoryFullName);
      return normalizedAllowedRepositories.has(normalizedRepositoryFullName);
    },
  };
};
