/**
 * Text people typed (a cancel reason, a note) keeps its own direction inside a
 * translated sentence: an English reason in an Arabic sentence must not have
 * its full stop pulled to the other side. FSI…PDI is the plain-text version of
 * <bdi>, usable in message arguments. Whole blocks of such text get dir="auto"
 * instead, because an isolate ends at a line break.
 */
export const isolate = (text: string) => `⁨${text}⁩`
