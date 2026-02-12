import fs from 'node:fs';
import path from 'node:path';

const SOURCE_ROOT = path.resolve(__dirname, '../../../../src/features/triage');
const DOMAIN_ROOT = path.join(SOURCE_ROOT, 'domain');
const APPLICATION_ROOT = path.join(SOURCE_ROOT, 'application');
const INFRASTRUCTURE_SEGMENT = `${path.sep}features${path.sep}triage${path.sep}infrastructure${path.sep}`;
const APPLICATION_SEGMENT = `${path.sep}features${path.sep}triage${path.sep}application${path.sep}`;

const IMPORT_PATTERN = /import(?:\s+type)?[\s\S]*?from\s+['"]([^'"]+)['"]/g;
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

const readRelativeImports = (filePath: string): string[] => {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const imports: string[] = [];

  for (const importMatch of fileContent.matchAll(IMPORT_PATTERN)) {
    const importPath = importMatch[1];
    if (typeof importPath === 'string' && importPath.startsWith('.')) {
      imports.push(importPath);
    }
  }

  return imports;
};

const resolveImportPath = (originFilePath: string, relativeImportPath: string): string =>
  path.normalize(path.resolve(path.dirname(originFilePath), relativeImportPath));

describe('TriageHexagonalBoundaries', () => {
  it('domain should not import application or infrastructure', () => {
    // Arrange
    const domainFiles = listTypescriptFiles(DOMAIN_ROOT);
    const violations: string[] = [];

    // Act
    for (const domainFile of domainFiles) {
      const relativeImports = readRelativeImports(domainFile);
      for (const relativeImport of relativeImports) {
        const resolvedImportPath = resolveImportPath(domainFile, relativeImport);
        if (
          resolvedImportPath.includes(APPLICATION_SEGMENT) ||
          resolvedImportPath.includes(INFRASTRUCTURE_SEGMENT)
        ) {
          violations.push(`${path.relative(SOURCE_ROOT, domainFile)} -> ${relativeImport}`);
        }
      }
    }

    // Assert
    expect(violations).toEqual([]);
  });

  it('application should not import infrastructure', () => {
    // Arrange
    const applicationFiles = listTypescriptFiles(APPLICATION_ROOT);
    const violations: string[] = [];

    // Act
    for (const applicationFile of applicationFiles) {
      const relativeImports = readRelativeImports(applicationFile);
      for (const relativeImport of relativeImports) {
        const resolvedImportPath = resolveImportPath(applicationFile, relativeImport);
        if (resolvedImportPath.includes(INFRASTRUCTURE_SEGMENT)) {
          violations.push(`${path.relative(SOURCE_ROOT, applicationFile)} -> ${relativeImport}`);
        }
      }
    }

    // Assert
    expect(violations).toEqual([]);
  });
});
