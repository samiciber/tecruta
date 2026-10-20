export default [{
  ignores: ['node_modules/**', 'server/node_modules/**', 'dist*/**', 'docs/**', '.vercel/**'],
}, {
  files: ['src/**/*.{js,jsx}', 'server/src/**/*.js', 'serverless/**/*.js', 'api/**/*.js', 'scripts/**/*.mjs'],
  linterOptions: { noInlineConfig: true },
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
  rules: {
    'constructor-super': 'error', 'for-direction': 'error', 'getter-return': 'error',
    'no-async-promise-executor': 'error', 'no-compare-neg-zero': 'error',
    'no-dupe-args': 'error', 'no-dupe-keys': 'error', 'no-duplicate-case': 'error',
    'no-func-assign': 'error', 'no-import-assign': 'error', 'no-self-assign': 'error',
    'no-unreachable': 'error', 'use-isnan': 'error', 'valid-typeof': 'error',
  },
}]
