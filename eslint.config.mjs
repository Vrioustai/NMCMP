import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

// Chặn chèn HTML thô vào trang: nội dung danmaku, bình luận, tên phim đều do người dùng
// nhập, nên chỉ được hiển thị dưới dạng text để không chạy được script lạ.
const noRawHtml = {
  "no-restricted-syntax": [
    "error",
    {
      selector: "AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]",
      message: "Không gán innerHTML/outerHTML. Dùng textContent hoặc JSX.",
    },
    {
      selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
      message: "Không dùng insertAdjacentHTML. Dùng textContent hoặc JSX.",
    },
    {
      selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
      message: "Không dùng dangerouslySetInnerHTML.",
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...compat.extends("next/core-web-vitals", "next/typescript").map((config) => ({
    ...config,
    files: ["apps/web/**/*.{js,mjs,ts,tsx}"],
  })),
  {
    files: ["apps/web/**/*.{js,mjs,ts,tsx}"],
    settings: { next: { rootDir: "apps/web" } },
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    rules: noRawHtml,
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { globals: { process: "readonly", module: "writable", require: "readonly" } },
  },
);
