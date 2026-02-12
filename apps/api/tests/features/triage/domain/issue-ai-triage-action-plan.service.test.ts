import { buildIssueAiTriageActionPlan } from '../../../../src/features/triage/domain/services/issue-ai-triage-action-plan.service';

const ISSUE_KIND_LABELS = ['kind/bug', 'kind/feature', 'kind/question'] as const;
const QUESTION_SIGNAL_KEYWORDS = ['how', 'can i', 'help'] as const;
const QUESTION_FALLBACK_CHECKLIST = ['- Share logs', '- Share config'] as const;

describe('IssueAiTriageActionPlanService', () => {
  it('should build actionable plans for classification, duplicate and question response', () => {
    // Arrange
    const input = {
      action: 'opened',
      issue: {
        number: 42,
        title: 'How can I setup telemetry?',
        body: 'Need help to configure exporter.',
      },
      existingLabels: ['kind/bug'],
      aiAnalysis: {
        classification: {
          type: 'question' as const,
          confidence: 0.95,
          reasoning: 'Question intent detected',
        },
        duplicateDetection: {
          isDuplicate: true,
          originalIssueNumber: null,
          similarityScore: 0.91,
          hasExplicitOriginalIssueReference: false,
        },
        sentiment: {
          tone: 'neutral' as const,
          confidence: 0.8,
          reasoning: 'Neutral tone',
        },
        suggestedResponse: 'Use the repository telemetry checklist.',
      },
      recentIssueNumbers: [42, 7],
      repositoryReadme: 'Repository telemetry checklist includes exporter setup.',
      kindPolicy: {
        bugLabel: 'kind/bug',
        featureLabel: 'kind/feature',
        questionLabel: 'kind/question',
        kindLabels: [...ISSUE_KIND_LABELS],
        classificationConfidenceThreshold: 0.8,
        sentimentConfidenceThreshold: 0.75,
      },
      duplicatePolicy: {
        similarityThreshold: 0.85,
        commentPrefix: 'AI Triage: Possible duplicate of #',
      },
      questionPolicy: {
        classificationConfidenceThreshold: 0.8,
        questionSignalKeywords: [...QUESTION_SIGNAL_KEYWORDS],
        fallbackChecklist: [...QUESTION_FALLBACK_CHECKLIST],
        aiSuggestedResponseCommentPrefix: 'AI Triage: Suggested guidance',
        fallbackChecklistCommentPrefix: 'AI Triage: Suggested setup checklist',
      },
      tonePolicy: {
        monitorLabel: 'triage/monitor',
      },
    };

    // Act
    const result = buildIssueAiTriageActionPlan(input);

    // Assert
    expect(result.classification.labelsToAdd).toEqual(['kind/question']);
    expect(result.classification.labelsToRemove).toEqual(['kind/bug']);
    expect(result.duplicate.shouldProcessSignal).toBe(true);
    expect(result.duplicate.commentPublicationPlan).toEqual({
      originalIssueNumber: 7,
      usedFallbackOriginalIssue: true,
      commentBody: 'AI Triage: Possible duplicate of #7 (Similarity: 91%).',
    });
    expect(result.question.commentPublicationPlan).toEqual({
      responseSource: 'ai_suggested_response',
      responseBody: 'Use the repository telemetry checklist.',
      commentPrefix: 'AI Triage: Suggested guidance',
      usedRepositoryContext: true,
    });
    expect(result.tone.shouldApplyMonitorLabel).toBe(false);
  });

  it('should suppress kind labels and activate monitor label on hostile high-confidence tone', () => {
    // Arrange
    const input = {
      action: 'opened',
      issue: {
        number: 8,
        title: 'Bug report',
        body: 'It fails',
      },
      existingLabels: ['kind/bug'],
      aiAnalysis: {
        classification: {
          type: 'bug' as const,
          confidence: 0.99,
          reasoning: 'Bug',
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0.2,
          hasExplicitOriginalIssueReference: false,
        },
        sentiment: {
          tone: 'hostile' as const,
          confidence: 0.95,
          reasoning: 'Hostile',
        },
        suggestedResponse: undefined,
      },
      recentIssueNumbers: [],
      repositoryReadme: undefined,
      kindPolicy: {
        bugLabel: 'kind/bug',
        featureLabel: 'kind/feature',
        questionLabel: 'kind/question',
        kindLabels: [...ISSUE_KIND_LABELS],
        classificationConfidenceThreshold: 0.8,
        sentimentConfidenceThreshold: 0.75,
      },
      duplicatePolicy: {
        similarityThreshold: 0.85,
        commentPrefix: 'AI Triage: Possible duplicate of #',
      },
      questionPolicy: {
        classificationConfidenceThreshold: 0.8,
        questionSignalKeywords: [...QUESTION_SIGNAL_KEYWORDS],
        fallbackChecklist: [...QUESTION_FALLBACK_CHECKLIST],
        aiSuggestedResponseCommentPrefix: 'AI Triage: Suggested guidance',
        fallbackChecklistCommentPrefix: 'AI Triage: Suggested setup checklist',
      },
      tonePolicy: {
        monitorLabel: 'triage/monitor',
      },
    };

    // Act
    const result = buildIssueAiTriageActionPlan(input);

    // Assert
    expect(result.classification.wasSuppressedByHostileTone).toBe(true);
    expect(result.classification.labelsToAdd).toEqual([]);
    expect(result.classification.labelsToRemove).toEqual(['kind/bug']);
    expect(result.tone.shouldApplyMonitorLabel).toBe(true);
  });
});
