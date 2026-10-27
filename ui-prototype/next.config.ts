import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

/**
 * The prototype is self-contained: all data comes from the in-memory mock
 * layer in src/server/mock. It never calls the Symfony API.
 *
 * Every page depends on the signed-in person and on the chosen language, both
 * read from cookies, so pages render per request and Cache Components are off.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

// Translations from messages/*.json (see src/i18n/request.ts). The declaration
// file lets TypeScript check the arguments of every message.
const withNextIntl = createNextIntlPlugin({
  experimental: { createMessagesDeclaration: "./messages/en.json" },
})

export default withNextIntl(nextConfig)
