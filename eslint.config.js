import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "backend/supabase/**", "tests/**/*.spec.ts", "load/out/**", "chaos/out/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["backend/**/*.ts", "documentation/scripts/**/*.ts", "tests/**/*.ts", "load/**/*.ts", "chaos/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    // k6 scripts run in k6's own runtime, which adds these globals.
    files: ["load/k6/**/*.js"],
    languageOptions: { globals: { ...globals.es2021, __ENV: "readonly", __VU: "readonly", __ITER: "readonly" } },
  },
  {
    files: ["frontend/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
