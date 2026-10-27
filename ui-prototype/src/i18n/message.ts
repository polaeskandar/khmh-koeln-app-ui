import type { MessageKeys, Messages, NestedKeyOf } from "next-intl"

/** Any message in the catalogs, e.g. "errors.services.adminOnly". */
export type MessageKey = MessageKeys<Messages, NestedKeyOf<Messages>>

export type MessageValues = Record<string, string | number>

/**
 * Text that is chosen in one place and translated in another: the data layer
 * raises errors as a key with values, and the server action translates them
 * into the person's language. The API will do the same with error codes.
 */
export type Message = { key: MessageKey; values?: MessageValues }

export const msg = (key: MessageKey, values?: MessageValues): Message => ({ key, values })
