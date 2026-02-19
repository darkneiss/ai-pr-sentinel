import fs from 'node:fs';
import path from 'node:path';

import { analyzeFeatureArchitecture } from './triage-architecture-check.tool';

const TYPESCRIPT_FILE_EXTENSION = '.ts';
const FEATURES_RELATIVE_ROOT = path.join('src', 'features');
const DDD_CONTEXT_MAP_RELATIVE_PATH = path.join('docs', 'ddd', 'context-map.md');
const APPLICATION_USE_CASES_RELATIVE_PATH = path.join('application', 'use-cases');
const DOMAIN_RELATIVE_PATH = 'domain';
const APPLICATION_RELATIVE_PATH = 'application';
const DOMAIN_MODEL_RELATIVE_PATHS = [
  path.join('domain', 'entities'),
  path.join('domain', 'value-objects'),
  path.join('domain', 'services'),
];

const CROSS_CONTEXT_IMPORT_REASON_TOKEN = 'cross_context_import_to_';
const JSON_FLAG = '--json';
const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_FAILURE = 1;

const DEFAULT_STRATEGIC_MIN_SCORE = 100;
const DEFAULT_TACTICAL_MIN_SCORE = 80;
const DEFAULT_GLOBAL_MIN_SCORE = 85;

const STRATEGIC_SCORE_ENV = 'DDD_MIN_STRATEGIC_SCORE';
const TACTICAL_SCORE_ENV = 'DDD_MIN_TACTICAL_SCORE';
const GLOBAL_SCORE_ENV = 'DDD_MIN_GLOBAL_SCORE';

const STRATEGIC_CHECK_COUNT = 5;
const TACTICAL_CHECK_COUNT = 4;

export type DddControlScores = {
  strategic: number;
  tactical: number;
  global: number;
};

export type DddControlThresholds = {
  strategic: number;
  tactical: number;
  global: number;
};

export type DddControlFindings = {
  strategic: string[];
  tactical: string[];
};

export type DddControlMetrics = {
  featureContextCount: number;
  crossContextImportViolationCount: number;
  boundaryViolationCount: number;
  contextsWithoutDomain: string[];
  contextsWithoutApplication: string[];
  contextsWithoutUseCases: string[];
  contextsWithoutDomainModel: string[];
};

export type DddControlReport = {
  isCompliant: boolean;
  scores: DddControlScores;
  thresholds: DddControlThresholds;
  findings: DddControlFindings;
  metrics: DddControlMetrics;
};

type DddControlCheckCliOptions = {
  argv?: string[];
  cwd?: string;
  outputWriter?: (output: string) => void;
  errorWriter?: (output: string) => void;
  env?: NodeJS.ProcessEnv;
};

const listTypescriptFiles = (directoryPath: string): string[] => {
  const directoryEntries = fs.readdirSync(directoryPath, { withFileTypes: true });

  return directoryEntries.flatMap((directoryEntry) => {
    const entryPath = path.join(directoryPath, directoryEntry.name);

    if (directoryEntry.isDirectory()) {
      return listTypescriptFiles(entryPath);
    }

    if (directoryEntry.isFile() && entryPath.endsWith(TYPESCRIPT_FILE_EXTENSION)) {
      return [entryPath];
    }

    return [];
  });
};

const listFeatureContextNames = (projectRootPath: string): string[] => {
  const featuresRootPath = path.resolve(projectRootPath, FEATURES_RELATIVE_ROOT);
  const featureEntries = fs.readdirSync(featuresRootPath, { withFileTypes: true });

  return featureEntries
    .filter((featureEntry) => featureEntry.isDirectory())
    .map((featureEntry) => featureEntry.name)
    .sort((left, right) => left.localeCompare(right));
};

const directoryExists = (directoryPath: string): boolean => {
  return fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory();
};

const fileExists = (filePath: string): boolean => {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
};

const hasContextMapDocument = (projectRootPath: string): boolean => {
  let currentPath = path.resolve(projectRootPath);

  while (true) {
    const candidatePath = path.resolve(currentPath, DDD_CONTEXT_MAP_RELATIVE_PATH);
    if (fileExists(candidatePath)) {
      return true;
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return false;
    }

    currentPath = parentPath;
  }
};

const hasTypescriptFiles = (directoryPath: string): boolean => {
  if (!directoryExists(directoryPath)) {
    return false;
  }

  return listTypescriptFiles(directoryPath).length > 0;
};

const buildFeatureContextPath = (projectRootPath: string, contextName: string): string => {
  return path.resolve(projectRootPath, FEATURES_RELATIVE_ROOT, contextName);
};

const buildScore = (failedChecks: number, totalChecks: number): number => {
  if (totalChecks <= 0) {
    return 100;
  }

  const successfulChecks = Math.max(0, totalChecks - failedChecks);
  return Math.round((successfulChecks / totalChecks) * 100);
};

const parseThreshold = (rawValue: string | undefined, defaultValue: number): number => {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return defaultValue;
  }

  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) {
    return defaultValue;
  }

  if (numericValue < 0) {
    return 0;
  }

  if (numericValue > 100) {
    return 100;
  }

  return Math.round(numericValue);
};

const resolveThresholds = (env: NodeJS.ProcessEnv): DddControlThresholds => {
  return {
    strategic: parseThreshold(env[STRATEGIC_SCORE_ENV], DEFAULT_STRATEGIC_MIN_SCORE),
    tactical: parseThreshold(env[TACTICAL_SCORE_ENV], DEFAULT_TACTICAL_MIN_SCORE),
    global: parseThreshold(env[GLOBAL_SCORE_ENV], DEFAULT_GLOBAL_MIN_SCORE),
  };
};

const buildContextStructureMetrics = (
  projectRootPath: string,
  contextNames: string[],
): Omit<
  DddControlMetrics,
  'featureContextCount' | 'crossContextImportViolationCount' | 'boundaryViolationCount'
> => {
  const contextsWithoutDomain: string[] = [];
  const contextsWithoutApplication: string[] = [];
  const contextsWithoutUseCases: string[] = [];
  const contextsWithoutDomainModel: string[] = [];

  for (const contextName of contextNames) {
    const contextRootPath = buildFeatureContextPath(projectRootPath, contextName);
    const domainPath = path.join(contextRootPath, DOMAIN_RELATIVE_PATH);
    const applicationPath = path.join(contextRootPath, APPLICATION_RELATIVE_PATH);
    const useCasesPath = path.join(contextRootPath, APPLICATION_USE_CASES_RELATIVE_PATH);

    if (!directoryExists(domainPath)) {
      contextsWithoutDomain.push(contextName);
    }

    if (!directoryExists(applicationPath)) {
      contextsWithoutApplication.push(contextName);
    }

    if (!hasTypescriptFiles(useCasesPath)) {
      contextsWithoutUseCases.push(contextName);
    }

    const hasDomainModel = DOMAIN_MODEL_RELATIVE_PATHS.some((domainModelRelativePath) =>
      hasTypescriptFiles(path.join(contextRootPath, domainModelRelativePath)),
    );
    if (!hasDomainModel) {
      contextsWithoutDomainModel.push(contextName);
    }
  }

  return {
    contextsWithoutDomain,
    contextsWithoutApplication,
    contextsWithoutUseCases,
    contextsWithoutDomainModel,
  };
};

const buildSortedFindings = (findings: string[]): string[] => {
  return [...findings].sort((left, right) => left.localeCompare(right));
};

export const analyzeDddControl = (
  projectRootPath: string,
  thresholds: DddControlThresholds = resolveThresholds(process.env),
): DddControlReport => {
  const hasDddContextMapDocument = hasContextMapDocument(projectRootPath);
  const contextNames = listFeatureContextNames(projectRootPath);
  const hasFeatureContexts = contextNames.length > 0;
  const featureArchitectureReport = analyzeFeatureArchitecture(projectRootPath);

  const crossContextImportViolationCount = featureArchitectureReport.violations.filter((violation) =>
    violation.includes(CROSS_CONTEXT_IMPORT_REASON_TOKEN),
  ).length;
  const boundaryViolationCount = featureArchitectureReport.violations.length - crossContextImportViolationCount;

  const contextStructureMetrics = buildContextStructureMetrics(projectRootPath, contextNames);
  const metrics: DddControlMetrics = {
    featureContextCount: contextNames.length,
    crossContextImportViolationCount,
    boundaryViolationCount,
    contextsWithoutDomain: contextStructureMetrics.contextsWithoutDomain,
    contextsWithoutApplication: contextStructureMetrics.contextsWithoutApplication,
    contextsWithoutUseCases: contextStructureMetrics.contextsWithoutUseCases,
    contextsWithoutDomainModel: contextStructureMetrics.contextsWithoutDomainModel,
  };

  const strategicFindings: string[] = [];
  if (!hasDddContextMapDocument) {
    strategicFindings.push('missing_context_map_document');
  }
  if (!hasFeatureContexts) {
    strategicFindings.push('missing_feature_contexts');
  }
  if (metrics.contextsWithoutDomain.length > 0) {
    strategicFindings.push('contexts_without_domain_layer');
  }
  if (metrics.contextsWithoutApplication.length > 0) {
    strategicFindings.push('contexts_without_application_layer');
  }
  if (metrics.crossContextImportViolationCount > 0) {
    strategicFindings.push('cross_context_imports_detected');
  }

  const tacticalFindings: string[] = [];
  if (metrics.boundaryViolationCount > 0) {
    tacticalFindings.push('boundary_violations_detected');
  }
  if (metrics.contextsWithoutUseCases.length > 0) {
    tacticalFindings.push('contexts_without_use_cases');
  }
  if (metrics.contextsWithoutDomainModel.length > 0) {
    tacticalFindings.push('contexts_without_domain_model');
  }
  if (!featureArchitectureReport.isCompliant) {
    tacticalFindings.push('feature_architecture_not_compliant');
  }

  const scores: DddControlScores = {
    strategic: buildScore(strategicFindings.length, STRATEGIC_CHECK_COUNT),
    tactical: buildScore(tacticalFindings.length, TACTICAL_CHECK_COUNT),
    global: Math.round(
      (buildScore(strategicFindings.length, STRATEGIC_CHECK_COUNT) +
        buildScore(tacticalFindings.length, TACTICAL_CHECK_COUNT)) /
        2,
    ),
  };

  const isCompliant =
    scores.strategic >= thresholds.strategic &&
    scores.tactical >= thresholds.tactical &&
    scores.global >= thresholds.global;

  return {
    isCompliant,
    scores,
    thresholds,
    findings: {
      strategic: buildSortedFindings(strategicFindings),
      tactical: buildSortedFindings(tacticalFindings),
    },
    metrics,
  };
};

export const buildDddControlHumanReadableOutput = (report: DddControlReport): string => {
  const statusLine = report.isCompliant
    ? 'DDD control check passed.'
    : 'DDD control check failed.';

  const sections = [
    statusLine,
    `Scores: strategic=${report.scores.strategic}, tactical=${report.scores.tactical}, global=${report.scores.global}`,
    `Thresholds: strategic>=${report.thresholds.strategic}, tactical>=${report.thresholds.tactical}, global>=${report.thresholds.global}`,
    `Metrics: contexts=${report.metrics.featureContextCount}, crossContextViolations=${report.metrics.crossContextImportViolationCount}, boundaryViolations=${report.metrics.boundaryViolationCount}`,
  ];

  if (report.findings.strategic.length > 0) {
    sections.push('Strategic findings:', ...report.findings.strategic.map((finding) => `- ${finding}`));
  }

  if (report.findings.tactical.length > 0) {
    sections.push('Tactical findings:', ...report.findings.tactical.map((finding) => `- ${finding}`));
  }

  return sections.join('\n');
};

export const runDddControlCheckCli = (options: DddControlCheckCliOptions = {}): number => {
  const argv = options.argv ?? process.argv;
  const cwd = options.cwd ?? process.cwd();
  const outputWriter = options.outputWriter ?? console.log;
  const env = options.env ?? process.env;
  const thresholds = resolveThresholds(env);
  const shouldOutputJson = argv.includes(JSON_FLAG);
  const report = analyzeDddControl(cwd, thresholds);

  if (shouldOutputJson) {
    outputWriter(JSON.stringify(report, null, 2));
  } else {
    outputWriter(buildDddControlHumanReadableOutput(report));
  }

  return report.isCompliant ? EXIT_CODE_SUCCESS : EXIT_CODE_FAILURE;
};

export const runDddControlCheckCliSafely = (options: DddControlCheckCliOptions = {}): number => {
  const errorWriter = options.errorWriter ?? console.error;

  try {
    return runDddControlCheckCli(options);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'unknown_error';
    errorWriter(`DDD control check tool failed: ${errorMessage}`);
    return EXIT_CODE_FAILURE;
  }
};

/* istanbul ignore next */
if (require.main === module) {
  process.exitCode = runDddControlCheckCliSafely();
}
