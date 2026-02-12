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
        historyCommentPrefix: 'AI Triage: Suggested',
        aiSuggestedResponseCommentPrefix: 'AI Triage: Suggested guidance',
        fallbackChecklistCommentPrefix: 'AI Triage: Suggested setup checklist',
      },
      tonePolicy: {
        monitorLabel: 'triage/monitor',
      },
      curationPolicy: {
        documentationLabel: 'documentation',
        helpWantedLabel: 'help wanted',
        goodFirstIssueLabel: 'good first issue',
        documentationConfidenceThreshold: 0.9,
        helpWantedConfidenceThreshold: 0.9,
        goodFirstIssueConfidenceThreshold: 0.95,
      },
    };

    // Act
    const result = buildIssueAiTriageActionPlan(input);

    // Assert
    expect(result.classification.labelsToAdd).toEqual(['kind/question']);
    expect(result.classification.labelsToRemove).toEqual(['kind/bug']);
    expect(result.duplicate.shouldProcessSignal).toBe(true);
    expect(result.duplicate.execution).toEqual({
      shouldApplyDuplicateLabel: true,
      commentBody: 'AI Triage: Possible duplicate of #7 (Similarity: 91%).',
      skipReason: null,
    });
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
    expect(result.tone.labelsToAdd).toEqual([]);
    expect(result.curation.labelsToAdd).toEqual([]);
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
        historyCommentPrefix: 'AI Triage: Suggested',
        aiSuggestedResponseCommentPrefix: 'AI Triage: Suggested guidance',
        fallbackChecklistCommentPrefix: 'AI Triage: Suggested setup checklist',
      },
      tonePolicy: {
        monitorLabel: 'triage/monitor',
      },
      curationPolicy: {
        documentationLabel: 'documentation',
        helpWantedLabel: 'help wanted',
        goodFirstIssueLabel: 'good first issue',
        documentationConfidenceThreshold: 0.9,
        helpWantedConfidenceThreshold: 0.9,
        goodFirstIssueConfidenceThreshold: 0.95,
      },
    };

    // Act
    const result = buildIssueAiTriageActionPlan(input);

    // Assert
    expect(result.classification.wasSuppressedByHostileTone).toBe(true);
    expect(result.classification.labelsToAdd).toEqual([]);
    expect(result.classification.labelsToRemove).toEqual(['kind/bug']);
    expect(result.duplicate.execution).toEqual({
      shouldApplyDuplicateLabel: false,
      commentBody: null,
      skipReason: 'signal_not_marked_duplicate',
    });
    expect(result.tone.labelsToAdd).toEqual(['triage/monitor']);
    expect(result.curation.labelsToAdd).toEqual([]);
  });

  it('should precompute question publication preparation decision in action plan', () => {
    // Arrange
    const input = {
      action: 'opened',
      issue: {
        number: 9,
        title: 'Question about setup',
        body: 'How do I configure the exporter?',
      },
      existingLabels: [],
      aiAnalysis: {
        classification: {
          type: 'question' as const,
          confidence: 0.92,
          reasoning: 'Question intent detected',
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0.2,
          hasExplicitOriginalIssueReference: false,
        },
        sentiment: {
          tone: 'neutral' as const,
          confidence: 0.8,
          reasoning: 'Neutral tone',
        },
        suggestedResponse: 'Check the telemetry section in README.',
      },
      recentIssueNumbers: [],
      repositoryReadme: 'Telemetry section documents exporter and env configuration.',
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
        historyCommentPrefix: 'AI Triage: Suggested',
        aiSuggestedResponseCommentPrefix: 'AI Triage: Suggested guidance',
        fallbackChecklistCommentPrefix: 'AI Triage: Suggested setup checklist',
      },
      tonePolicy: {
        monitorLabel: 'triage/monitor',
      },
      curationPolicy: {
        documentationLabel: 'documentation',
        helpWantedLabel: 'help wanted',
        goodFirstIssueLabel: 'good first issue',
        documentationConfidenceThreshold: 0.9,
        helpWantedConfidenceThreshold: 0.9,
        goodFirstIssueConfidenceThreshold: 0.95,
      },
    };

    // Act
    const result = buildIssueAiTriageActionPlan(input);

    // Assert
    expect(result.question.publicationPreparation).toEqual({
      shouldCheckExistingQuestionReplyComment: true,
      historyLookupBodyPrefix: 'AI Triage: Suggested',
      publicationPlan: {
        responseSource: 'ai_suggested_response',
        responseBody: 'Check the telemetry section in README.',
        commentPrefix: 'AI Triage: Suggested guidance',
        usedRepositoryContext: true,
      },
      responseSource: 'ai_suggested_response',
      usedRepositoryContext: true,
      skipReason: null,
    });
  });

  it('should plan curated github labels when AI recommendations are high-confidence', () => {
    // Arrange
    const input = {
      action: 'opened',
      issue: {
        number: 15,
        title: 'How to document onboarding setup?',
        body: 'Please improve the setup docs and we can help with implementation.',
      },
      existingLabels: [],
      aiAnalysis: {
        classification: {
          type: 'feature' as const,
          confidence: 0.93,
          reasoning: 'Feature request around docs quality',
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0.1,
          hasExplicitOriginalIssueReference: false,
        },
        sentiment: {
          tone: 'neutral' as const,
          confidence: 0.8,
          reasoning: 'Neutral tone',
        },
        labelRecommendations: {
          documentation: {
            shouldApply: true,
            confidence: 0.95,
          },
          helpWanted: {
            shouldApply: true,
            confidence: 0.92,
          },
          goodFirstIssue: {
            shouldApply: true,
            confidence: 0.96,
          },
        },
      },
      recentIssueNumbers: [],
      repositoryReadme: 'Readme content',
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
        historyCommentPrefix: 'AI Triage: Suggested',
        aiSuggestedResponseCommentPrefix: 'AI Triage: Suggested guidance',
        fallbackChecklistCommentPrefix: 'AI Triage: Suggested setup checklist',
      },
      tonePolicy: {
        monitorLabel: 'triage/monitor',
      },
      curationPolicy: {
        documentationLabel: 'documentation',
        helpWantedLabel: 'help wanted',
        goodFirstIssueLabel: 'good first issue',
        documentationConfidenceThreshold: 0.9,
        helpWantedConfidenceThreshold: 0.9,
        goodFirstIssueConfidenceThreshold: 0.95,
      },
    };

    // Act
    const result = buildIssueAiTriageActionPlan(input);

    // Assert
    expect(result.curation.labelsToAdd).toEqual(['documentation', 'help wanted', 'good first issue']);
  });
});
