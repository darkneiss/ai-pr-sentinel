import fs from 'node:fs';
import path from 'node:path';

const TYPESCRIPT_FILE_EXTENSION = '.ts';

// Feature discovery and legacy single-context compatibility.
const FEATURES_RELATIVE_ROOT = path.join('src', 'features');
const FEATURE_ROOT_SEGMENT = `${path.sep}features${path.sep}`;
const TRIAGE_CONTEXT_NAME = 'triage';

const IMPORT_FROM_PATTERN = /import(?:\s+type)?[\s\S]*?from\s+['"]([^'"]+)['"]/g;
const SIDE_EFFECT_IMPORT_PATTERN = /import\s+['"]([^'"]+)['"]/g;
const EXPORT_FROM_PATTERN = /export(?:\s+type)?[\s\S]*?from\s+['"]([^'"]+)['"]/g;
const SOURCE_IMPORT_PREFIX = 'src/';

const JSON_FLAG = '--json';
const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_FAILURE = 1;

const LAYER_NAMES = ['domain', 'application', 'infrastructure', 'external'] as const;
type LayerName = (typeof LAYER_NAMES)[number];

type FileLayerName = Exclude<LayerName, 'external'>;

const FILE_LAYER_NAMES: FileLayerName[] = ['domain', 'application', 'infrastructure'];

type ImportsByLayer = Record<LayerName, number>;

type LayerCouplingMetrics = {
  internalImports: number;
  importsByLayer: ImportsByLayer;
};

type LayerChangeSurfaceMetrics = {
  fileCount: number;
  importCount: number;
  averageImportsPerFile: number;
};

export type ArchitectureMetrics = {
  coupling: Record<FileLayerName, LayerCouplingMetrics>;
  changeSurface: Record<FileLayerName, LayerChangeSurfaceMetrics>;
};

export type ArchitectureContextReport = {
  isCompliant: boolean;
  violations: string[];
  metrics: ArchitectureMetrics;
};

export type ArchitectureAnalysisReport = {
  isCompliant: boolean;
  violations: string[];
  metrics: ArchitectureMetrics;
  contexts?: Record<string, ArchitectureContextReport>;
};

type LayerFileAnalysis = {
  absoluteFilePath: string;
  relativeFilePath: string;
  layer: FileLayerName;
  contextName: string;
  imports: string[];
};

type FeatureFileLocation = {
  contextName: string;
  layer: FileLayerName | null;
};

type ImportTarget = {
  layer: LayerName;
  contextName: string | null;
};

type AnalyzeArchitectureOptions = {
  contextNames: string[];
  shouldPrefixContextNameInViolation: boolean;
};

const buildImportsByLayer = (): ImportsByLayer => {
  return {
    domain: 0,
    application: 0,
    infrastructure: 0,
    external: 0,
  };
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

const readImports = (filePath: string): string[] => {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const imports: string[] = [];
  const dependencyPathPatterns = [
    IMPORT_FROM_PATTERN,
    SIDE_EFFECT_IMPORT_PATTERN,
    EXPORT_FROM_PATTERN,
  ];

  for (const dependencyPathPattern of dependencyPathPatterns) {
    for (const importMatch of fileContent.matchAll(dependencyPathPattern)) {
      const importPath = importMatch[1];
      if (
        typeof importPath === 'string' &&
        (importPath.startsWith('.') || importPath.startsWith(SOURCE_IMPORT_PREFIX))
      ) {
        imports.push(importPath);
      }
    }
  }

  return imports;
};

const resolveImportPath = (
  projectRootPath: string,
  originFilePath: string,
  importPath: string,
): string => {
  if (importPath.startsWith(SOURCE_IMPORT_PREFIX)) {
    return path.normalize(path.resolve(projectRootPath, importPath));
  }

  return path.normalize(path.resolve(path.dirname(originFilePath), importPath));
};

const toExistingTypescriptFilePath = (resolvedImportPath: string): string | null => {
  if (fs.existsSync(resolvedImportPath) && fs.statSync(resolvedImportPath).isFile()) {
    return resolvedImportPath;
  }

  const withTypescriptExtension = `${resolvedImportPath}${TYPESCRIPT_FILE_EXTENSION}`;
  if (fs.existsSync(withTypescriptExtension) && fs.statSync(withTypescriptExtension).isFile()) {
    return withTypescriptExtension;
  }

  const indexFilePath = path.join(resolvedImportPath, `index${TYPESCRIPT_FILE_EXTENSION}`);
  if (fs.existsSync(indexFilePath) && fs.statSync(indexFilePath).isFile()) {
    return indexFilePath;
  }

  return null;
};

const listFeatureContextNames = (projectRootPath: string): string[] => {
  const featuresRootPath = path.resolve(projectRootPath, FEATURES_RELATIVE_ROOT);
  const featureEntries = fs.readdirSync(featuresRootPath, { withFileTypes: true });

  return featureEntries
    .filter((featureEntry) => featureEntry.isDirectory())
    .map((featureEntry) => featureEntry.name)
    .sort((left, right) => left.localeCompare(right));
};

const detectFeatureFileLocation = (absoluteFilePath: string): FeatureFileLocation | null => {
  const normalizedFilePath = path.normalize(absoluteFilePath);
  const featureRootSegmentIndex = normalizedFilePath.lastIndexOf(FEATURE_ROOT_SEGMENT);

  if (featureRootSegmentIndex === -1) {
    return null;
  }

  const relativeToFeatureRoot = normalizedFilePath.slice(
    featureRootSegmentIndex + FEATURE_ROOT_SEGMENT.length,
  );
  const locationSegments = relativeToFeatureRoot.split(path.sep);
  const contextName = locationSegments[0];
  const layerCandidate = locationSegments[1];

  /* istanbul ignore next -- defensive guard for malformed normalized feature paths */
  if (typeof contextName !== 'string' || contextName.length === 0) {
    return null;
  }

  if (typeof layerCandidate !== 'string') {
    return { contextName, layer: null };
  }

  if (FILE_LAYER_NAMES.includes(layerCandidate as FileLayerName)) {
    return {
      contextName,
      layer: layerCandidate as FileLayerName,
    };
  }

  return { contextName, layer: null };
};

const detectFileLayer = (absoluteFilePath: string): FileLayerName | null => {
  const featureFileLocation = detectFeatureFileLocation(absoluteFilePath);
  /* istanbul ignore next -- defensive guard if a path is outside the expected features layout */
  if (featureFileLocation === null) {
    return null;
  }

  return featureFileLocation.layer;
};

const collectContextFiles = (projectRootPath: string, contextName: string): LayerFileAnalysis[] => {
  const contextRootPath = path.resolve(projectRootPath, FEATURES_RELATIVE_ROOT, contextName);
  const contextFiles = listTypescriptFiles(contextRootPath);

  return contextFiles.flatMap((absoluteFilePath) => {
    const layer = detectFileLayer(absoluteFilePath);

    if (layer === null) {
      return [];
    }

    return [
      {
        absoluteFilePath,
        relativeFilePath: path.relative(contextRootPath, absoluteFilePath),
        layer,
        contextName,
        imports: readImports(absoluteFilePath),
      },
    ];
  });
};

const detectImportTarget = (
  projectRootPath: string,
  originFilePath: string,
  importPath: string,
): ImportTarget => {
  const resolvedImportPath = resolveImportPath(projectRootPath, originFilePath, importPath);
  const existingImportPath = toExistingTypescriptFilePath(resolvedImportPath);

  if (existingImportPath === null) {
    return { layer: 'external', contextName: null };
  }

  const featureFileLocation = detectFeatureFileLocation(existingImportPath);
  if (featureFileLocation === null) {
    return { layer: 'external', contextName: null };
  }

  if (featureFileLocation.layer === null) {
    return {
      layer: 'external',
      contextName: featureFileLocation.contextName,
    };
  }

  return {
    layer: featureFileLocation.layer,
    contextName: featureFileLocation.contextName,
  };
};

const evaluateBoundaryViolation = (sourceLayer: FileLayerName, targetLayer: LayerName): boolean => {
  if (sourceLayer === 'domain') {
    return targetLayer === 'application' || targetLayer === 'infrastructure';
  }

  if (sourceLayer === 'application') {
    return targetLayer === 'infrastructure';
  }

  return false;
};

const buildMetrics = (
  layerFiles: LayerFileAnalysis[],
  projectRootPath: string,
): ArchitectureMetrics => {
  const coupling = {
    domain: { internalImports: 0, importsByLayer: buildImportsByLayer() },
    application: { internalImports: 0, importsByLayer: buildImportsByLayer() },
    infrastructure: { internalImports: 0, importsByLayer: buildImportsByLayer() },
  };

  const changeSurface = {
    domain: { fileCount: 0, importCount: 0, averageImportsPerFile: 0 },
    application: { fileCount: 0, importCount: 0, averageImportsPerFile: 0 },
    infrastructure: { fileCount: 0, importCount: 0, averageImportsPerFile: 0 },
  };

  for (const layerName of FILE_LAYER_NAMES) {
    const filesInLayer = layerFiles.filter((layerFile) => layerFile.layer === layerName);
    changeSurface[layerName].fileCount = filesInLayer.length;
  }

  for (const layerFile of layerFiles) {
    for (const importPath of layerFile.imports) {
      const target = detectImportTarget(projectRootPath, layerFile.absoluteFilePath, importPath);

      coupling[layerFile.layer].importsByLayer[target.layer] += 1;
      if (target.layer !== 'external') {
        coupling[layerFile.layer].internalImports += 1;
      }

      changeSurface[layerFile.layer].importCount += 1;
    }
  }

  for (const layerName of FILE_LAYER_NAMES) {
    const layerFileCount = changeSurface[layerName].fileCount;

    changeSurface[layerName].averageImportsPerFile =
      layerFileCount === 0
        ? 0
        : Number((changeSurface[layerName].importCount / layerFileCount).toFixed(2));
  }

  return {
    coupling,
    changeSurface,
  };
};

const buildViolationSourcePath = (
  contextName: string,
  contextRootPath: string,
  absoluteFilePath: string,
  shouldPrefixContextNameInViolation: boolean,
): string => {
  const relativeFilePath = path.relative(contextRootPath, absoluteFilePath);

  if (!shouldPrefixContextNameInViolation) {
    return relativeFilePath;
  }

  return `${contextName}:${relativeFilePath}`;
};

const analyzeArchitectureByContext = (
  projectRootPath: string,
  options: AnalyzeArchitectureOptions,
): ArchitectureAnalysisReport => {
  const contextReports: Record<string, ArchitectureContextReport> = {};
  const allLayerFiles: LayerFileAnalysis[] = [];
  const violations: string[] = [];

  for (const contextName of options.contextNames) {
    const contextRootPath = path.resolve(projectRootPath, FEATURES_RELATIVE_ROOT, contextName);
    const contextFiles = collectContextFiles(projectRootPath, contextName);
    const contextViolations = new Set<string>();

    for (const contextFile of contextFiles) {
      for (const importPath of contextFile.imports) {
        const target = detectImportTarget(projectRootPath, contextFile.absoluteFilePath, importPath);
        const isBoundaryViolation = evaluateBoundaryViolation(contextFile.layer, target.layer);
        const isCrossContextImport =
          target.contextName !== null && target.contextName !== contextFile.contextName;

        if (!isBoundaryViolation && !isCrossContextImport) {
          continue;
        }

        const sourcePath = buildViolationSourcePath(
          contextName,
          contextRootPath,
          contextFile.absoluteFilePath,
          options.shouldPrefixContextNameInViolation,
        );

        if (isBoundaryViolation) {
          contextViolations.add(`${sourcePath} -> ${importPath}`);
        }

        if (isCrossContextImport) {
          contextViolations.add(
            `${sourcePath} -> ${importPath} (cross_context_import_to_${target.contextName})`,
          );
        }
      }
    }

    const sortedContextViolations = [...contextViolations].sort((left, right) =>
      left.localeCompare(right),
    );

    contextReports[contextName] = {
      isCompliant: sortedContextViolations.length === 0,
      violations: sortedContextViolations,
      metrics: buildMetrics(contextFiles, projectRootPath),
    };

    allLayerFiles.push(...contextFiles);
    violations.push(...sortedContextViolations);
  }

  return {
    isCompliant: violations.length === 0,
    violations: [...violations].sort((left, right) => left.localeCompare(right)),
    metrics: buildMetrics(allLayerFiles, projectRootPath),
    contexts: contextReports,
  };
};

export const analyzeFeatureArchitecture = (projectRootPath: string): ArchitectureAnalysisReport => {
  const contextNames = listFeatureContextNames(projectRootPath);

  return analyzeArchitectureByContext(projectRootPath, {
    contextNames,
    shouldPrefixContextNameInViolation: true,
  });
};

export const analyzeTriageArchitecture = (projectRootPath: string): ArchitectureAnalysisReport => {
  return analyzeArchitectureByContext(projectRootPath, {
    contextNames: [TRIAGE_CONTEXT_NAME],
    shouldPrefixContextNameInViolation: false,
  });
};

export const buildArchitectureHumanReadableOutput = (report: ArchitectureAnalysisReport): string => {
  const statusLine = report.isCompliant
    ? 'Architecture check passed: no hexagonal boundary violations.'
    : `Architecture check failed: ${report.violations.length} violation(s).`;

  const violationLines = report.violations.map((violation) => `- ${violation}`);
  const couplingLines = FILE_LAYER_NAMES.map((layerName) => {
    const coupling = report.metrics.coupling[layerName];
    return `${layerName}: internal=${coupling.internalImports}, domain=${coupling.importsByLayer.domain}, application=${coupling.importsByLayer.application}, infrastructure=${coupling.importsByLayer.infrastructure}, external=${coupling.importsByLayer.external}`;
  });

  const changeSurfaceLines = FILE_LAYER_NAMES.map((layerName) => {
    const changeSurface = report.metrics.changeSurface[layerName];
    return `${layerName}: files=${changeSurface.fileCount}, imports=${changeSurface.importCount}, avgImportsPerFile=${changeSurface.averageImportsPerFile}`;
  });

  const sections = [
    statusLine,
    'Coupling metrics by layer:',
    ...couplingLines,
    'Change-surface metrics by layer:',
    ...changeSurfaceLines,
  ];

  const contextEntries = Object.entries(report.contexts ?? {}).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  if (contextEntries.length > 0) {
    sections.push('Context compliance:');

    for (const [contextName, contextReport] of contextEntries) {
      sections.push(
        `${contextName}: compliant=${contextReport.isCompliant}, violations=${contextReport.violations.length}`,
      );
    }
  }

  if (!report.isCompliant) {
    sections.push('Violations:', ...violationLines);
  }

  return sections.join('\n');
};

type ArchitectureCheckCliOptions = {
  argv?: string[];
  cwd?: string;
  outputWriter?: (output: string) => void;
  errorWriter?: (output: string) => void;
};

export const runArchitectureCheckCli = (options: ArchitectureCheckCliOptions = {}): number => {
  const argv = options.argv ?? process.argv;
  const cwd = options.cwd ?? process.cwd();
  const outputWriter = options.outputWriter ?? console.log;
  const shouldOutputJson = argv.includes(JSON_FLAG);
  const report = analyzeFeatureArchitecture(cwd);

  if (shouldOutputJson) {
    outputWriter(JSON.stringify(report, null, 2));
  } else {
    outputWriter(buildArchitectureHumanReadableOutput(report));
  }

  return report.isCompliant ? EXIT_CODE_SUCCESS : EXIT_CODE_FAILURE;
};

export const runArchitectureCheckCliSafely = (options: ArchitectureCheckCliOptions = {}): number => {
  const errorWriter = options.errorWriter ?? console.error;

  try {
    return runArchitectureCheckCli(options);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'unknown_error';
    errorWriter(`Architecture check tool failed: ${errorMessage}`);
    return EXIT_CODE_FAILURE;
  }
};

/* istanbul ignore next */
if (require.main === module) {
  process.exitCode = runArchitectureCheckCliSafely();
}
