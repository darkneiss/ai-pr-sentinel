/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Buscamos tests tanto en la carpeta tests/ como archivos .spec.ts
  testMatch: ['**/tests/**/*.test.ts', '**/*.spec.ts'],
  // Directorio raíz para Jest (el de la propia app api)
  rootDir: '.',
  // Limpia llamadas a mocks entre tests para evitar efectos secundarios
  clearMocks: true,
  // Configuración de Cobertura (Importante para la memoria del TFM)
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/'],
};
