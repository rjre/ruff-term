import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "apps/web/public/**"],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      // Underscore-prefixed bindings are the codebase's existing convention
      // for "deliberately discarded" (e.g. destructuring a key out of an
      // object to drop it).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
    },
  },

  // Frontend: the react-hooks rules are the point of adding a linter here.
  // exhaustive-deps is what would have caught the usePriceFlashes bug, where
  // an inline-built array as an effect dependency tore down the effect's own
  // timer on every render.
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // exhaustive-deps stays an error: it is the rule that catches real
      // bugs here, and the reason this linter exists. usePriceFlashes shipped
      // with an inline-built array as an effect dependency, which tore down
      // the effect's own timer on every render.
      "react-hooks/exhaustive-deps": "error",

      // An error now that the codebase is clean of it. Async loads store
      // their result alongside the request key so "loading" is derived in
      // render; resets on a changed prop adjust state during render; external
      // stores are read with useSyncExternalStore.
      "react-hooks/set-state-in-effect": "error",
    },
  },

  {
    files: ["apps/server/src/**/*.ts", "scripts/**/*.mjs"],
    languageOptions: { globals: { ...globals.node } },
  },
);
