import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/src-tauri/target/**',
      '**/*.d.ts',
      '**/coverage/**',
      // Ignore CommonJS config files
      'packages/config/**/*.js',
      // Ignore scripts (often have different lint requirements)
      'scripts/**',
      // Ignore git worktrees (local dev only)
      '.worktrees/**',
    ],
  },

  // Base JS config
  js.configs.recommended,

  // TypeScript config for all TS files
  ...tseslint.configs.recommended,

  // React config for frontend files
  {
    files: ['apps/desktop/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Shared rules for all files
  {
    rules: {
      // TypeScript specific
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',

      // General - relaxed for initial CI setup
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
      'prefer-const': 'warn',
      'no-var': 'error',
      'no-case-declarations': 'warn',
      'no-useless-escape': 'warn',
      'no-useless-catch': 'warn',
    },
  }
)
