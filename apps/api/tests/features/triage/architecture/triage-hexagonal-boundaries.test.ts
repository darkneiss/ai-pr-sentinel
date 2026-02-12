import fs from 'node:fs';
import path from 'node:path';

const SOURCE_ROOT = path.resolve(__dirname, '../../../../src/features/triage');
const PROJECT_SRC_ROOT = path.resolve(__dirname, '../../../../src');
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

const readImports = (filePath: string): string[] => {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const imports: string[] = [];

  for (const importMatch of fileContent.matchAll(IMPORT_PATTERN)) {
    const importPath = importMatch[1];
    if (
      typeof importPath === 'string' &&
      (importPath.startsWith('.') || importPath.startsWith('src/'))
    ) {
      imports.push(importPath);
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

describe('TriageHexagonalBoundaries', () => {
  it('domain should not import application or infrastructure', () => {
    // Arrange
    const domainFiles = listTypescriptFiles(DOMAIN_ROOT);
    const violations: string[] = [];

    // Act
    for (const domainFile of domainFiles) {
      const imports = readImports(domainFile);
      for (const importPath of imports) {
        const resolvedImportPath = resolveImportPath(domainFile, importPath);
        if (
          resolvedImportPath.includes(APPLICATION_SEGMENT) ||
          resolvedImportPath.includes(INFRASTRUCTURE_SEGMENT)
        ) {
          violations.push(`${path.relative(SOURCE_ROOT, domainFile)} -> ${importPath}`);
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
      const imports = readImports(applicationFile);
      for (const importPath of imports) {
        const resolvedImportPath = resolveImportPath(applicationFile, importPath);
        if (resolvedImportPath.includes(INFRASTRUCTURE_SEGMENT)) {
          violations.push(`${path.relative(SOURCE_ROOT, applicationFile)} -> ${importPath}`);
        }
      }
    }

    // Assert
    expect(violations).toEqual([]);
  });
});
