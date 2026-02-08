export interface RepositoryContext {
  readme?: string;
}

export interface RepositoryContextGateway {
  findRepositoryContext(input: { repositoryFullName: string }): Promise<RepositoryContext>;
}
