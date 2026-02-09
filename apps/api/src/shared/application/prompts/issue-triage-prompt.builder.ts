const MAX_REPOSITORY_CONTEXT_CHARS = 4000;
const CONTROL_CHARACTERS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

interface RecentIssueSummary {
  number: number;
  title: string;
}

interface RenderIssueTriageUserPromptInput {
  template: string;
  issueTitle: string;
  issueBody: string;
  recentIssues: RecentIssueSummary[];
  repositoryContext?: string;
}

const sanitizePromptText = (value: string): string => value.replace(CONTROL_CHARACTERS_REGEX, '');

const buildRecentIssuesBlock = (recentIssues: RecentIssueSummary[]): string => {
  const recentIssuesBlock = recentIssues
    .map((recentIssue) => `#${recentIssue.number}: ${sanitizePromptText(recentIssue.title)}`)
    .join('\n');

  return recentIssuesBlock || '(none)';
};

const buildRepositoryContextBlock = (repositoryContext?: string): string => {
  const normalizedRepositoryContext = repositoryContext?.trim();
  if (!normalizedRepositoryContext) {
    return '(none)';
  }

  return sanitizePromptText(normalizedRepositoryContext).slice(0, MAX_REPOSITORY_CONTEXT_CHARS);
};

export const renderIssueTriageUserPrompt = (input: RenderIssueTriageUserPromptInput): string => {
  const sanitizedIssueTitle = sanitizePromptText(input.issueTitle);
  const sanitizedIssueBody = sanitizePromptText(input.issueBody);
  const repositoryContextBlock = buildRepositoryContextBlock(input.repositoryContext);
  const recentIssuesBlock = buildRecentIssuesBlock(input.recentIssues);

  return input.template
    .split('{{issue_title}}')
    .join(sanitizedIssueTitle)
    .split('{{issue_body}}')
    .join(sanitizedIssueBody)
    .split('{{repository_context}}')
    .join(repositoryContextBlock)
    .split('{{recent_issues}}')
    .join(recentIssuesBlock);
};
