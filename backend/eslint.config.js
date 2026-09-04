// @ts-check
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        global: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^next$|^req$|^res$' }],
      'no-console': 'off', // Will be replaced with structured logger in PR5
      'no-var': 'error',
      'prefer-const': 'warn',
      eqeqeq: ['warn', 'always'],
      'no-throw-literal': 'error',
    },
  },
]);
