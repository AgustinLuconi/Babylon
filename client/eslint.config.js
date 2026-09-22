import js from "@eslint/js";
import globals from "globals";
// Fijado en 5.x a propósito (no @latest): eslint-plugin-react-hooks 6/7
// incorpora las reglas de "React Compiler" (ej. react-hooks/set-state-in-effect)
// al set recommended, mucho más estrictas — no son parte de esta actualización
// de ESLint, adoptarlas es una decisión aparte.
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
);
