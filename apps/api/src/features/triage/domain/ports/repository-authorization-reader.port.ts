export interface RepositoryAuthorizationReader {
  isAllowed(repositoryFullName: string): boolean;
}
