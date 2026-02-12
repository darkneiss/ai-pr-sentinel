export interface RepositoryContext {
  readme?: string;
}

export interface RepositoryContextReader {
  findRepositoryContext(input: { repositoryFullName: string }): Promise<RepositoryContext>;
}
