module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: ['eslint:recommended', 'plugin:react-hooks/recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['react-hooks'],
  rules: {
    // React components intentionally use props/state names that are consumed by JSX.
    // Hook dependency validation remains enabled below.
    'no-unused-vars': 'off',
  },
  ignorePatterns: ['dist/', 'node_modules/'],
};
