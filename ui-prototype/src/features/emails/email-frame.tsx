"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "cn"

/**
 * An email in a frame of its own, so its mail-client HTML and CSS can't reach the page. The frame
 * grows to the email's height, and links in it open in a new tab.
 */
export function EmailFrame({
  html,
  title,
  className,
}: {
  html: string
  title: string
  className?: string
}) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(720)

  useEffect(() => {
    const frame = ref.current
    if (!frame) return
    let observer: ResizeObserver | undefined
    const measure = () => {
      const body = frame.contentDocument?.body
      // The frame's first document is an empty page; wait for the email.
      if (body && body.scrollHeight > 0) setHeight(Math.ceil(body.getBoundingClientRect().height))
    }
    const attach = () => {
      measure()
      observer?.disconnect()
      const body = frame.contentDocument?.body
      if (body) {
        observer = new ResizeObserver(measure)
        observer.observe(body)
      }
    }
    frame.addEventListener("load", attach)
    if (frame.contentDocument?.readyState === "complete") attach()
    return () => {
      frame.removeEventListener("load", attach)
      observer?.disconnect()
    }
  }, [html])

  return (
    <iframe
      ref={ref}
      srcDoc={html}
      title={title}
      // No scripts in an email; same origin only so the page can measure it.
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      className={cn("block border-0", className)}
      style={{ height }}
    />
  )
}
