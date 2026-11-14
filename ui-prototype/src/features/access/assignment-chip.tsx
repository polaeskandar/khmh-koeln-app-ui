import Link from "next/link"

/** A role someone has and where; links to that place in Access when the viewer manages it. */
export function AssignmentChip({
  role,
  scope,
  href,
}: {
  role: string
  scope: string
  href: string | null
}) {
  const content = (
    <>
      <span className="font-medium">{role}</span>
      <span className="text-muted-foreground">· {scope}</span>
    </>
  )

  return (
    <li className="flex border text-sm">
      {href ? (
        <Link
          href={href}
          className="flex items-center gap-1 px-3 py-1 underline-offset-4 hover:bg-muted/40 hover:underline"
        >
          {content}
        </Link>
      ) : (
        <span className="flex items-center gap-1 px-3 py-1">{content}</span>
      )}
    </li>
  )
}
