import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "next-env.d.ts",
      "prisma/migrations/**",
      // Git worktrees live under .claude/ and hold full source copies; ESLint
      // walks the filesystem (not .gitignore), so exclude them explicitly or a
      // repo-root `eslint .` lints every worktree's duplicate tree.
      ".claude/**",
    ],
  },
];

export default eslintConfig;
