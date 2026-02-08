export interface RecentIssueSummary {
  number: number;
  title: string;
  labels: string[];
  state: 'open' | 'closed';
}

export interface IssueHistoryGateway {
  findRecentIssues(input: {
    repositoryFullName: string;
    limit: number;
  }): Promise<RecentIssueSummary[]>;
}
