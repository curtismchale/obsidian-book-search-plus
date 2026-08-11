import obsidianmd from 'eslint-plugin-obsidianmd';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...obsidianmd.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { args: 'all', argsIgnorePattern: '^_' }],
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-prototype-builtins': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
  {
    // Test files and test scaffolding: add jest globals and relax the
    // obsidian-specific rules. `test/` holds the setup and mock modules whose
    // whole job is installing the Obsidian globals and stubbing `requestUrl`,
    // so the runtime rules those files "violate" do not apply to them.
    files: ['**/*.test.ts', 'test/**/*.{ts,js,mjs}'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        global: 'readonly',
      },
    },
    rules: {
      'obsidianmd/prefer-abstract-input-suggest': 'off',
      'obsidianmd/prefer-active-doc': 'off',
      'obsidianmd/prefer-active-window-timers': 'off',
      // Test polyfills implement the Obsidian DOM helpers, so they must use the
      // native DOM APIs this rule would otherwise rewrite.
      'obsidianmd/prefer-create-el': 'off',
      'obsidianmd/ui/sentence-case': 'off',
      // test/mock_obsidian.ts implements the requestUrl stub with fetch, which
      // is the point of the mock — there is no requestUrl to defer to.
      'no-restricted-globals': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    // Plain JS config and setup scripts live outside the TypeScript project, so
    // the type-aware rules cannot resolve type information for them and error
    // out ("You have used a rule which requires type information"). Lint them
    // with the untyped rule set and give them the Node globals they rely on.
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        global: 'readonly',
      },
    },
  },
  {
    ignores: ['node_modules/**', 'main.js', 'build/**'],
  },
);
