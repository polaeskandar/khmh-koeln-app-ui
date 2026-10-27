import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Defaults of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Premium blocks kept unchanged for comparison (see reference/README.md); not part of the build.
    "reference/**",
    "test-results/**",
    "playwright-report/**",
  ]),
])

export default eslintConfig
