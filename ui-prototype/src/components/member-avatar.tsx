import { cn } from "cn"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"

// Quiet, low-chroma tints from the stone/emerald family so a long roster reads
// calmly; in dark mode the same hues, dark with light letters. No photos: the
// MVP person record is deliberately minimal.
const TINTS = [
  "bg-[oklch(0.93_0.03_165)] text-[oklch(0.38_0.07_165)] dark:bg-[oklch(0.32_0.04_165)] dark:text-[oklch(0.9_0.05_165)]",
  "bg-[oklch(0.93_0.02_240)] text-[oklch(0.4_0.07_245)] dark:bg-[oklch(0.32_0.04_245)] dark:text-[oklch(0.9_0.04_240)]",
  "bg-[oklch(0.94_0.03_80)] text-[oklch(0.45_0.08_60)] dark:bg-[oklch(0.34_0.05_60)] dark:text-[oklch(0.92_0.05_80)]",
  "bg-[oklch(0.93_0.02_300)] text-[oklch(0.42_0.08_300)] dark:bg-[oklch(0.32_0.05_300)] dark:text-[oklch(0.9_0.04_300)]",
  "bg-[oklch(0.93_0.01_60)] text-[oklch(0.4_0.02_60)] dark:bg-[oklch(0.32_0.01_60)] dark:text-[oklch(0.9_0.01_60)]",
  "bg-[oklch(0.94_0.025_20)] text-[oklch(0.45_0.08_25)] dark:bg-[oklch(0.33_0.05_25)] dark:text-[oklch(0.91_0.04_20)]",
]

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

export function MemberAvatar({
  name,
  initials,
  seed,
  className,
}: {
  name: string
  initials: string
  seed?: string
  className?: string
}) {
  const tint = TINTS[hash(seed ?? name) % TINTS.length]
  // Decorative: the name is always written next to it, so screen readers skip the initials.
  return (
    <Avatar className={cn("size-8", className)} aria-hidden="true" title={name}>
      <AvatarFallback className={cn("font-medium", tint)}>{initials}</AvatarFallback>
    </Avatar>
  )
}
