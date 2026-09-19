import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['.output/**', '.wxt/**', 'node_modules/**', 'tests/fixtures/**']),
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
    },
  },
  {
    files: ['src/core/logger/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },
]);
