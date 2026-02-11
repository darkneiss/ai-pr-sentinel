export interface RepositoryAuthorizationGateway {
  isAllowed(repositoryFullName: string): boolean;
}
