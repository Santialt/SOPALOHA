const js = require("@eslint/js");
const reactHooks = require("eslint-plugin-react-hooks");
const globals = require("globals");

const webLegacyNoUnusedVarsFiles = [
  "apps/web/src/App.jsx",
  "apps/web/src/main.jsx",
  "apps/web/src/components/AdminRoute.jsx",
  "apps/web/src/components/AppShell.jsx",
  "apps/web/src/components/CurrentOnCallBlock.jsx",
  "apps/web/src/components/EntityCommentsPanel.jsx",
  "apps/web/src/components/LocationQuickSearch.jsx",
  "apps/web/src/components/ProtectedRoute.jsx",
  "apps/web/src/pages/DashboardPage.jsx",
  "apps/web/src/pages/IncidentsPage.jsx",
  "apps/web/src/pages/LocationDetailPage.jsx",
  "apps/web/src/pages/LocationsPage.jsx",
  "apps/web/src/pages/LoginPage.jsx",
  "apps/web/src/pages/OnCallPage.jsx",
  "apps/web/src/pages/TasksPage.jsx",
  "apps/web/src/pages/TeamViewerExplorerPage.jsx",
  "apps/web/src/pages/TeamViewerImportPage.jsx",
  "apps/web/src/pages/TeamViewerImportedCasesPage.jsx",
  "apps/web/src/pages/UsersPage.jsx",
  "apps/web/src/pages/WeeklyTasksPage.jsx",
  "apps/web/src/router/index.jsx",
];

module.exports = [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/.vite/**",
      "data/**",
    ],
  },
  js.configs.recommended,
  {
    files: [
      "apps/api/**/*.js",
      "apps/api/test/**/*.js",
      "scripts/**/*.js",
      "*.js",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["apps/web/**/*.js", "apps/web/**/*.jsx"],
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: webLegacyNoUnusedVarsFiles,
    rules: {
      "no-unused-vars": "off",
    },
  },
  {
    files: ["apps/web/src/hooks/useDataLoader.js"],
    rules: {
      "react-hooks/exhaustive-deps": "off",
    },
  },
];
