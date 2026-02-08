export const ISSUE_TRIAGE_SYSTEM_PROMPT =
  'You are an issue triage assistant. Return valid JSON only and do not include markdown.';

interface BuildIssueTriageUserPromptInput {
  issueTitle: string;
  issueBody: string;
  recentIssues: { number: number; title: string }[];
}

export const buildIssueTriageUserPrompt = (input: BuildIssueTriageUserPromptInput): string => {
  const recentIssuesBlock = input.recentIssues
    .map((recentIssue) => `#${recentIssue.number}: ${recentIssue.title}`)
    .join('\n');

  return [
    `Issue title: ${input.issueTitle}`,
    `Issue body: ${input.issueBody}`,
    'Recent issues:',
    recentIssuesBlock || '(none)',
    'Return a JSON object with classification, duplicate detection, tone and suggestedResponse fields.',
    'If classification.type is question, suggestedResponse is mandatory and must contain 3-6 checklist bullets.',
    'If classification.type is not question, suggestedResponse must be empty or omitted.',
    'Use exactly these enums: classification.type in ["bug","feature","question"], sentiment.tone in ["positive","neutral","hostile"].',
    'Use confidence and similarityScore as numbers between 0 and 1.',
    'Do not invent fields. Do not return markdown. Return only valid JSON.',
  ].join('\n');
};
