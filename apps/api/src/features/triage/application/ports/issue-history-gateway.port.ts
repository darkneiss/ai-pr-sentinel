import type { IssueHistoryReader } from '../../domain/ports/issue-history-reader.port';

export type { RecentIssueSummary } from '../../domain/ports/issue-history-reader.port';

export interface IssueHistoryGateway extends IssueHistoryReader {}
