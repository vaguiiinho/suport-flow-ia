import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/.next/**", "**/coverage/**", "**/node_modules/**", "apps/api/prisma/migrations/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/**/*.{js,mjs,cjs,ts,tsx}", "packages/**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node
      }
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ]
    }
  },
  {
    files: ["apps/web/**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  }
);
