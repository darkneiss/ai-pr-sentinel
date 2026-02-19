import fs from 'node:fs';
import path from 'node:path';

const FEATURES_ROOT = path.resolve(__dirname, '../../../../src/features');
const PROJECT_SRC_ROOT = path.resolve(__dirname, '../../../../src');
const FEATURE_ROOT_SEGMENT = `${path.sep}features${path.sep}`;
const INFRASTRUCTURE_SEGMENT = `${path.sep}infrastructure${path.sep}`;
const APPLICATION_SEGMENT = `${path.sep}application${path.sep}`;

const IMPORT_PATTERN = /import(?:\s+type)?[\s\S]*?from\s+['"]([^'"]+)['"]/g;
const SIDE_EFFECT_IMPORT_PATTERN = /import\s+['"]([^'"]+)['"]/g;
const EXPORT_PATTERN = /export(?:\s+type)?[\s\S]*?from\s+['"]([^'"]+)['"]/g;
const TYPESCRIPT_FILE_EXTENSION = '.ts';

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
  const dependencyPathPatterns = [IMPORT_PATTERN, SIDE_EFFECT_IMPORT_PATTERN, EXPORT_PATTERN];

  for (const dependencyPathPattern of dependencyPathPatterns) {
    for (const importMatch of fileContent.matchAll(dependencyPathPattern)) {
      const importPath = importMatch[1];
      if (
        typeof importPath === 'string' &&
        (importPath.startsWith('.') || importPath.startsWith('src/'))
      ) {
        imports.push(importPath);
      }
    }
  }

  return imports;
};

const resolveImportPath = (originFilePath: string, importPath: string): string => {
  if (importPath.startsWith('src/')) {
    return path.normalize(path.resolve(PROJECT_SRC_ROOT, importPath.replace(/^src\//, '')));
  }

  return path.normalize(path.resolve(path.dirname(originFilePath), importPath));
};

const listFeatureContexts = (): string[] => {
  const featureEntries = fs.readdirSync(FEATURES_ROOT, { withFileTypes: true });

  return featureEntries
    .filter((featureEntry) => featureEntry.isDirectory())
    .map((featureEntry) => featureEntry.name)
    .sort((left, right) => left.localeCompare(right));
};

const detectFeatureContextName = (absoluteFilePath: string): string | null => {
  const normalizedAbsoluteFilePath = path.normalize(absoluteFilePath);
  const featureRootIndex = normalizedAbsoluteFilePath.lastIndexOf(FEATURE_ROOT_SEGMENT);

  if (featureRootIndex === -1) {
    return null;
  }

  const relativeToFeatureRoot = normalizedAbsoluteFilePath.slice(
    featureRootIndex + FEATURE_ROOT_SEGMENT.length,
  );
  const segments = relativeToFeatureRoot.split(path.sep);
  const contextName = segments[0];

  if (typeof contextName !== 'string' || contextName.length === 0) {
    return null;
  }

  return contextName;
};

const directoryExists = (directoryPath: string): boolean => {
  return fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory();
};

describe('FeatureHexagonalBoundaries', () => {
  it('domain should not import application/infrastructure nor other feature contexts', () => {
    // Arrange
    const featureContexts = listFeatureContexts();
    const violations: string[] = [];

    // Act
    for (const featureContext of featureContexts) {
      const featureRoot = path.join(FEATURES_ROOT, featureContext);
      const domainRoot = path.join(featureRoot, 'domain');

      if (!directoryExists(domainRoot)) {
        continue;
      }

      const domainFiles = listTypescriptFiles(domainRoot);
      for (const domainFile of domainFiles) {
        const imports = readImports(domainFile);
        for (const importPath of imports) {
          const resolvedImportPath = resolveImportPath(domainFile, importPath);
          const targetFeatureContext = detectFeatureContextName(resolvedImportPath);
          const isCrossContextImport =
            targetFeatureContext !== null && targetFeatureContext !== featureContext;

          if (
            resolvedImportPath.includes(APPLICATION_SEGMENT) ||
            resolvedImportPath.includes(INFRASTRUCTURE_SEGMENT) ||
            isCrossContextImport
          ) {
            violations.push(`${path.relative(featureRoot, domainFile)} -> ${importPath}`);
          }
        }
      }
    }

    // Assert
    expect(violations).toEqual([]);
  });

  it('application should not import infrastructure nor other feature contexts', () => {
    // Arrange
    const featureContexts = listFeatureContexts();
    const violations: string[] = [];

    // Act
    for (const featureContext of featureContexts) {
      const featureRoot = path.join(FEATURES_ROOT, featureContext);
      const applicationRoot = path.join(featureRoot, 'application');

      if (!directoryExists(applicationRoot)) {
        continue;
      }

      const applicationFiles = listTypescriptFiles(applicationRoot);
      for (const applicationFile of applicationFiles) {
        const imports = readImports(applicationFile);
        for (const importPath of imports) {
          const resolvedImportPath = resolveImportPath(applicationFile, importPath);
          const targetFeatureContext = detectFeatureContextName(resolvedImportPath);
          const isCrossContextImport =
            targetFeatureContext !== null && targetFeatureContext !== featureContext;

          if (resolvedImportPath.includes(INFRASTRUCTURE_SEGMENT) || isCrossContextImport) {
            violations.push(`${path.relative(featureRoot, applicationFile)} -> ${importPath}`);
          }
        }
      }
    }

    // Assert
    expect(violations).toEqual([]);
  });
});
