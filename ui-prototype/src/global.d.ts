import type { Locale } from "@/i18n/config"

import type messages from "../messages/en.json"

// Message keys and their arguments are checked against the English catalog.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale
    Messages: typeof messages
  }
}
