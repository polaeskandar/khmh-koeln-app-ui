/**
 * The German and Arabic catalogs carry every English message, with the same
 * arguments used the same way, so no screen shows a raw key or drops a name
 * or a count. English is the reference: its keys and arguments are what the
 * code is type-checked against.
 */
import { checkTranslations } from "@/test/catalogs"

import ar from "../../messages/ar.json"
import de from "../../messages/de.json"
import en from "../../messages/en.json"

checkTranslations("catalog", en, [
  ["German", de],
  ["Arabic", ar],
])
