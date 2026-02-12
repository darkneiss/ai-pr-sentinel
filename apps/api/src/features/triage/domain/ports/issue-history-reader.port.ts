export interface RecentIssueSummary {
  number: number;
  title: string;
  labels: string[];
  state: 'open' | 'closed';
}

export interface IssueHistoryReader {
  findRecentIssues(input: {
    repositoryFullName: string;
    limit: number;
  }): Promise<RecentIssueSummary[]>;
  hasIssueCommentWithPrefix(input: {
    repositoryFullName: string;
    issueNumber: number;
    bodyPrefix: string;
    authorLogin?: string;
  }): Promise<boolean>;
}
