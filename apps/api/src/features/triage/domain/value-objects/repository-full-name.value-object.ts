const REPOSITORY_SEPARATOR = '/';
const REPOSITORY_PARTS_COUNT = 2;

export class RepositoryFullName {
  private constructor(
    public readonly value: string,
    public readonly owner: string,
    public readonly repo: string,
  ) {}

  public static create(rawValue: string): RepositoryFullName {
    const normalizedValue = rawValue.trim();
    const repositoryParts = normalizedValue.split(REPOSITORY_SEPARATOR);
    const [owner, repo] = repositoryParts;
    const hasInvalidRepositoryFormat =
      repositoryParts.length !== REPOSITORY_PARTS_COUNT || !owner || !repo;

    if (hasInvalidRepositoryFormat) {
      throw new Error(`Invalid repository full name: "${rawValue}"`);
    }

    const value = `${owner}${REPOSITORY_SEPARATOR}${repo}`;
    return new RepositoryFullName(value, owner, repo);
  }
}
