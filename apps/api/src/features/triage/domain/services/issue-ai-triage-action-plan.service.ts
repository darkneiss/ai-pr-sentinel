import type { AiAnalysis, AiTone } from './issue-ai-analysis-normalizer.service';
import {
  decideIssueDuplicateActions,
  planIssueDuplicateCommentPublication,
  resolveFallbackDuplicateIssueNumber,
  shouldProcessIssueDuplicateSignal,
  type IssueDuplicateActionsDecision,
  type IssueDuplicateCommentPublicationPlan,
} from './issue-duplicate-policy.service';
import {
  planIssueKindLabelActions,
  type IssueKindLabelActionsDecision,
} from './issue-kind-label-policy.service';
import {
  buildIssueQuestionFallbackResponseWhenApplicable,
  decideIssueQuestionResponseAction,
  isLikelyQuestionIssueContent,
  normalizeIssueQuestionSuggestedResponse,
  planIssueQuestionResponseCommentPublication,
  type IssueQuestionResponseCommentPublicationPlan,
  type IssueQuestionResponseDecision,
} from './issue-question-response-policy.service';
import { shouldApplyIssueToneMonitorLabel } from './issue-tone-monitor-policy.service';

interface IssueInput {
  number: number;
  title: string;
  body: string;
}

interface KindPolicyInput {
  bugLabel: string;
  featureLabel: string;
  questionLabel: string;
  kindLabels: readonly string[];
  classificationConfidenceThreshold: number;
  sentimentConfidenceThreshold: number;
}

interface DuplicatePolicyInput {
  similarityThreshold: number;
  commentPrefix: string;
}

interface QuestionPolicyInput {
  classificationConfidenceThreshold: number;
  questionSignalKeywords: readonly string[];
  fallbackChecklist: readonly string[];
  aiSuggestedResponseCommentPrefix: string;
  fallbackChecklistCommentPrefix: string;
}

interface TonePolicyInput {
  monitorLabel: string;
}

export interface BuildIssueAiTriageActionPlanInput {
  action: string;
  issue: IssueInput;
  existingLabels: string[];
  aiAnalysis: AiAnalysis;
  recentIssueNumbers: readonly number[];
  repositoryReadme: string | undefined;
  kindPolicy: KindPolicyInput;
  duplicatePolicy: DuplicatePolicyInput;
  questionPolicy: QuestionPolicyInput;
  tonePolicy: TonePolicyInput;
}

export interface IssueAiTriageDuplicatePlan {
  shouldProcessSignal: boolean;
  decision: IssueDuplicateActionsDecision;
  commentPublicationPlan: IssueDuplicateCommentPublicationPlan | null;
}

export interface IssueAiTriageQuestionPlan {
  decision: IssueQuestionResponseDecision;
  commentPublicationPlan: IssueQuestionResponseCommentPublicationPlan | null;
}

export interface IssueAiTriageTonePlan {
  labelsToAdd: string[];
}

export interface IssueAiTriageActionPlan {
  effectiveTone: AiTone;
  classification: IssueKindLabelActionsDecision;
  duplicate: IssueAiTriageDuplicatePlan;
  question: IssueAiTriageQuestionPlan;
  tone: IssueAiTriageTonePlan;
}

export const buildIssueAiTriageActionPlan = ({
  action,
  issue,
  existingLabels,
  aiAnalysis,
  recentIssueNumbers,
  repositoryReadme,
  kindPolicy,
  duplicatePolicy,
  questionPolicy,
  tonePolicy,
}: BuildIssueAiTriageActionPlanInput): IssueAiTriageActionPlan => {
  const classification = planIssueKindLabelActions({
    issueKind: aiAnalysis.classification.type,
    bugLabel: kindPolicy.bugLabel,
    featureLabel: kindPolicy.featureLabel,
    questionLabel: kindPolicy.questionLabel,
    classificationConfidence: aiAnalysis.classification.confidence,
    classificationConfidenceThreshold: kindPolicy.classificationConfidenceThreshold,
    sentimentTone: aiAnalysis.sentiment.tone,
    sentimentConfidence: aiAnalysis.sentiment.confidence,
    sentimentConfidenceThreshold: kindPolicy.sentimentConfidenceThreshold,
    existingLabels,
    kindLabels: kindPolicy.kindLabels,
  });

  const shouldProcessDuplicateSignal = shouldProcessIssueDuplicateSignal({
    isDuplicate: aiAnalysis.duplicateDetection.isDuplicate,
  });
  const duplicateDecision = decideIssueDuplicateActions({
    isDuplicate: aiAnalysis.duplicateDetection.isDuplicate,
    originalIssueNumber: aiAnalysis.duplicateDetection.originalIssueNumber,
    similarityScore: aiAnalysis.duplicateDetection.similarityScore,
    hasExplicitOriginalIssueReference: aiAnalysis.duplicateDetection.hasExplicitOriginalIssueReference === true,
    currentIssueNumber: issue.number,
    fallbackOriginalIssueNumber: resolveFallbackDuplicateIssueNumber({
      currentIssueNumber: issue.number,
      recentIssueNumbers,
    }),
    similarityThreshold: duplicatePolicy.similarityThreshold,
  });
  const duplicateCommentPublicationPlan = planIssueDuplicateCommentPublication({
    decision: duplicateDecision,
    commentPrefix: duplicatePolicy.commentPrefix,
    similarityScore: aiAnalysis.duplicateDetection.similarityScore,
  });

  const normalizedSuggestedResponse = normalizeIssueQuestionSuggestedResponse(aiAnalysis.suggestedResponse);
  const looksLikeQuestionIssue = isLikelyQuestionIssueContent({
    title: issue.title,
    body: issue.body,
    questionSignalKeywords: questionPolicy.questionSignalKeywords,
  });
  const fallbackQuestionResponse = buildIssueQuestionFallbackResponseWhenApplicable({
    looksLikeQuestionIssue,
    checklistLines: questionPolicy.fallbackChecklist,
  });
  const questionDecision = decideIssueQuestionResponseAction({
    action,
    effectiveTone: aiAnalysis.sentiment.tone,
    classificationType: aiAnalysis.classification.type,
    classificationConfidence: aiAnalysis.classification.confidence,
    classificationConfidenceThreshold: questionPolicy.classificationConfidenceThreshold,
    looksLikeQuestionIssue,
    normalizedSuggestedResponse,
    fallbackQuestionResponse,
  });
  const questionCommentPublicationPlan = planIssueQuestionResponseCommentPublication({
    decision: questionDecision,
    repositoryReadme,
    aiSuggestedResponseCommentPrefix: questionPolicy.aiSuggestedResponseCommentPrefix,
    fallbackChecklistCommentPrefix: questionPolicy.fallbackChecklistCommentPrefix,
  });

  const shouldApplyMonitorLabel = shouldApplyIssueToneMonitorLabel({
    effectiveTone: aiAnalysis.sentiment.tone,
  });
  const tonePlan: IssueAiTriageTonePlan = {
    labelsToAdd: shouldApplyMonitorLabel ? [tonePolicy.monitorLabel] : [],
  };

  return {
    effectiveTone: aiAnalysis.sentiment.tone,
    classification,
    duplicate: {
      shouldProcessSignal: shouldProcessDuplicateSignal,
      decision: duplicateDecision,
      commentPublicationPlan: duplicateCommentPublicationPlan,
    },
    question: {
      decision: questionDecision,
      commentPublicationPlan: questionCommentPublicationPlan,
    },
    tone: tonePlan,
  };
};
