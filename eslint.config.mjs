import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: { "@next/next/no-img-element": "off", "@next/next/no-html-link-for-pages": "off" } },
  globalIgnores([".next/**", ".next-preview*/**", "out/**", "node_modules/**", "public/original/**", "reference/**", "artifacts/**", "playwright-report/**", "test-results/**", "next-env.d.ts"])
]);
