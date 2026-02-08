export interface GovernanceGateway {
  addLabels(input: { repositoryFullName: string; issueNumber: number; labels: string[] }): Promise<void>;
  removeLabel(input: { repositoryFullName: string; issueNumber: number; label: string }): Promise<void>;
  createComment(input: { repositoryFullName: string; issueNumber: number; body: string }): Promise<void>;
  logValidatedIssue(input: { repositoryFullName: string; issueNumber: number }): Promise<void>;
}
