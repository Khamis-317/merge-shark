import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import reactCompiler from 'eslint-plugin-react-compiler';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,tsx}'],
    plugins: {
      'react-compiler': reactCompiler,
    },
    languageOptions: { globals: globals.browser },
    rules: {
      'react-compiler/react-compiler': 'error',
    },
  },
  {
    ignores: ['dist/*'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierRecommended,
]);
