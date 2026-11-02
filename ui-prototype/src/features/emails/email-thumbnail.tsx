import { cn } from "cn"

/**
 * The top of an email at half size, as a picture: the email is drawn twice as wide as the box
 * and scaled down, so it shows its desktop layout.
 */
export function EmailThumbnail({
  html,
  title,
  className,
}: {
  html: string
  title: string
  className?: string
}) {
  return (
    <div className={cn("relative h-64 overflow-hidden bg-muted/40", className)} aria-hidden="true">
      <iframe
        srcDoc={html}
        title={title}
        tabIndex={-1}
        sandbox=""
        className="pointer-events-none absolute top-0 h-[1040px] w-[200%] scale-50 border-0 ltr:left-0 ltr:origin-top-left rtl:right-0 rtl:origin-top-right"
      />
    </div>
  )
}
