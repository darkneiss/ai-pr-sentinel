import fs from 'node:fs';
import path from 'node:path';

const TYPESCRIPT_FILE_EXTENSION = '.ts';
const TRIAGE_RELATIVE_ROOT = path.join('src', 'features', 'triage');
const DOMAIN_SEGMENT = `${path.sep}domain${path.sep}`;
const APPLICATION_SEGMENT = `${path.sep}application${path.sep}`;
const INFRASTRUCTURE_SEGMENT = `${path.sep}infrastructure${path.sep}`;
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

export type ArchitectureAnalysisReport = {
  isCompliant: boolean;
  violations: string[];
  metrics: {
    coupling: Record<FileLayerName, LayerCouplingMetrics>;
    changeSurface: Record<FileLayerName, LayerChangeSurfaceMetrics>;
  };
};

type LayerFileAnalysis = {
  absoluteFilePath: string;
  relativeFilePath: string;
  layer: FileLayerName;
  imports: string[];
};

const TRIAGE_ROOT_SEGMENT = `${path.sep}features${path.sep}triage${path.sep}`;

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

const detectFileLayer = (absoluteFilePath: string): FileLayerName | null => {
  if (absoluteFilePath.includes(DOMAIN_SEGMENT)) {
    return 'domain';
  }

  if (absoluteFilePath.includes(APPLICATION_SEGMENT)) {
    return 'application';
  }

  if (absoluteFilePath.includes(INFRASTRUCTURE_SEGMENT)) {
    return 'infrastructure';
  }

  return null;
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

const detectImportLayer = (absoluteFilePath: string): LayerName => {
  const isTriageImport = absoluteFilePath.includes(TRIAGE_ROOT_SEGMENT);
  if (!isTriageImport) {
    return 'external';
  }

  const layer = detectFileLayer(absoluteFilePath);
  if (layer === null) {
    return 'external';
  }

  return layer;
};

const collectTriageFiles = (projectRootPath: string): LayerFileAnalysis[] => {
  const triageRootPath = path.resolve(projectRootPath, TRIAGE_RELATIVE_ROOT);
  const triageFiles = listTypescriptFiles(triageRootPath);

  return triageFiles.flatMap((absoluteFilePath) => {
    const layer = detectFileLayer(absoluteFilePath);

    if (layer === null) {
      return [];
    }

    return [
      {
        absoluteFilePath,
        relativeFilePath: path.relative(triageRootPath, absoluteFilePath),
        layer,
        imports: readImports(absoluteFilePath),
      },
    ];
  });
};

const evaluateBoundaryViolation = (
  sourceLayer: FileLayerName,
  targetLayer: LayerName,
): boolean => {
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
): ArchitectureAnalysisReport['metrics'] => {
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
      const resolvedImportPath = resolveImportPath(
        projectRootPath,
        layerFile.absoluteFilePath,
        importPath,
      );

      const existingImportPath = toExistingTypescriptFilePath(resolvedImportPath);
      const targetLayer = existingImportPath ? detectImportLayer(existingImportPath) : 'external';

      coupling[layerFile.layer].importsByLayer[targetLayer] += 1;
      if (targetLayer !== 'external') {
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

export const analyzeTriageArchitecture = (projectRootPath: string): ArchitectureAnalysisReport => {
  const triageFiles = collectTriageFiles(projectRootPath);
  const triageRootPath = path.resolve(projectRootPath, TRIAGE_RELATIVE_ROOT);
  const violations: string[] = [];

  for (const triageFile of triageFiles) {
    for (const importPath of triageFile.imports) {
      const resolvedImportPath = resolveImportPath(
        projectRootPath,
        triageFile.absoluteFilePath,
        importPath,
      );
      const existingImportPath = toExistingTypescriptFilePath(resolvedImportPath);
      const targetLayer = existingImportPath ? detectImportLayer(existingImportPath) : 'external';

      if (!evaluateBoundaryViolation(triageFile.layer, targetLayer)) {
        continue;
      }

      violations.push(`${path.relative(triageRootPath, triageFile.absoluteFilePath)} -> ${importPath}`);
    }
  }

  return {
    isCompliant: violations.length === 0,
    violations: violations.sort((left, right) => left.localeCompare(right)),
    metrics: buildMetrics(triageFiles, projectRootPath),
  };
};

const buildHumanReadableOutput = (report: ArchitectureAnalysisReport): string => {
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

  if (!report.isCompliant) {
    sections.push('Violations:', ...violationLines);
  }

  return sections.join('\n');
};

const runCli = (): number => {
  const shouldOutputJson = process.argv.includes(JSON_FLAG);
  const report = analyzeTriageArchitecture(process.cwd());

  if (shouldOutputJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(buildHumanReadableOutput(report));
  }

  return report.isCompliant ? EXIT_CODE_SUCCESS : EXIT_CODE_FAILURE;
};

if (require.main === module) {
  try {
    process.exitCode = runCli();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'unknown_error';
    console.error(`Architecture check tool failed: ${errorMessage}`);
    process.exitCode = EXIT_CODE_FAILURE;
  }
}
