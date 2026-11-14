import type { ViewerInfo } from "./view-models"

type Words = { administrator: string; parent: string; member: string; none: string }

/** One line about an account's access: "Administrator", "Sunday School › 1st Class", "Parent". */
export function describeAccess(person: Pick<ViewerInfo, "access" | "areas">, words: Words): string {
  if (person.access.administrator) {
    return words.administrator
  }

  if (person.access.places.length > 0) {
    return person.access.places.join(", ")
  }

  if (person.areas.parent) {
    return words.parent
  }

  return person.areas.member ? words.member : words.none
}
