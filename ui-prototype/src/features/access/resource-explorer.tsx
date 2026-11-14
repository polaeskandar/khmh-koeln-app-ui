"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Lock, Search } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import type { ExplorerNode, ExplorerPage, ResourceLabel } from "@/lib/view-models"
import { explorerChildrenAction, searchResourcesAction } from "@/server/actions/access"

import { TypeIcon } from "./labels"

type Row =
  | {
      kind: "node"
      node: ExplorerNode
      level: number
      parent: string | null
      pos: number
      size: number
    }
  | { kind: "more"; key: string; group: string; level: number; offset: number }
  | { kind: "loading"; key: string; level: number }

type Result = ResourceLabel & { key: string; path: string }

export function accessResourceHref(key: string) {
  return `/admin/access?tab=resources&r=${encodeURIComponent(key)}`
}

/**
 * The resource hierarchy as a tree (WAI-ARIA tree pattern): arrow keys move and open, Enter
 * selects. Children load when a branch opens; many lessons or sessions come grouped and a page at a
 * time. Only places where the viewer manages access, and the places leading to them, are listed.
 */
export function ResourceExplorer({
  root,
  pages: initialPages,
  expanded: initialExpanded,
  selected,
  onNavigate,
  className,
}: {
  root: ExplorerNode
  pages: Record<string, ExplorerPage>
  expanded: string[]
  selected: string | null
  onNavigate?: () => void
  className?: string
}) {
  const t = useTranslations("access.explorer")
  const router = useRouter()
  const [pages, setPages] = useState(initialPages)
  const [expanded, setExpanded] = useState(() => new Set(initialExpanded))
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [failed, setFailed] = useState<Set<string>>(new Set())
  const [focusKey, setFocusKey] = useState<string>(selected ?? root.key)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Result[] | null>(null)
  const [searching, startSearch] = useTransition()
  const items = useRef(new Map<string, HTMLDivElement>())

  const [seen, setSeen] = useState(initialPages)

  if (seen !== initialPages) {
    setSeen(initialPages)
    setPages((current) => ({ ...current, ...initialPages }))
    setExpanded((current) => new Set([...current, ...initialExpanded]))

    if (selected) {
      setFocusKey(selected)
    }
  }

  const searchTerm = query.trim()
  const shownResults = searchTerm.length < 2 ? null : results

  useEffect(() => {
    const q = searchTerm

    if (q.length < 2) {
      return
    }

    const timer = setTimeout(() => {
      startSearch(async () => {
        const result = await searchResourcesAction(q)
        setResults(result.ok ? result.data : [])
      })
    }, 250)

    return () => clearTimeout(timer)
  }, [searchTerm])

  const load = useCallback(async (key: string, offset: number) => {
    setLoading((s) => new Set(s).add(key))
    setFailed((s) => {
      const next = new Set(s)
      next.delete(key)

      return next
    })
    const result = await explorerChildrenAction(key, offset)
    setLoading((s) => {
      const next = new Set(s)
      next.delete(key)

      return next
    })

    if (!result.ok) {
      setFailed((s) => new Set(s).add(key))

      return
    }

    setPages((current) => ({
      ...current,
      [key]:
        offset === 0
          ? result.data
          : {
              nodes: [...(current[key]?.nodes ?? []), ...result.data.nodes],
              next: result.data.next,
            },
    }))
  }, [])

  const toggle = useCallback(
    (node: ExplorerNode, open?: boolean) => {
      const willOpen = open ?? !expanded.has(node.key)
      setExpanded((current) => {
        const next = new Set(current)

        if (willOpen) {
          next.add(node.key)
        } else {
          next.delete(node.key)
        }

        return next
      })

      if (willOpen && !pages[node.key]) {
        void load(node.key, 0)
      }
    },
    [expanded, pages, load]
  )

  const rows = useMemo(() => {
    const out: Row[] = []
    const walk = (
      node: ExplorerNode,
      level: number,
      parent: string | null,
      pos: number,
      size: number
    ) => {
      out.push({ kind: "node", node, level, parent, pos, size })

      if (!node.expandable || !expanded.has(node.key)) {
        return
      }

      const page = pages[node.key]

      if (!page) {
        out.push({ kind: "loading", key: `${node.key}#loading`, level: level + 1 })

        return
      }

      page.nodes.forEach((child, i) => walk(child, level + 1, node.key, i + 1, page.nodes.length))

      if (page.next !== null) {
        out.push({
          kind: "more",
          key: `${node.key}#more`,
          group: node.key,
          level: level + 1,
          offset: page.next,
        })
      }
    }
    walk(root, 1, null, 1, 1)

    return out
  }, [root, pages, expanded])

  const keyOf = (row: Row) => (row.kind === "node" ? row.node.key : row.key)

  const go = (node: ExplorerNode) => {
    if (node.kind === "resource" && node.manageable) {
      router.push(accessResourceHref(node.key), { scroll: false })
      onNavigate?.()
    } else if (node.expandable) {
      toggle(node)
    }
  }

  const focusRow = (key: string) => {
    setFocusKey(key)
    items.current.get(key)?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const row = rows[index]
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl"
    const forward = rtl ? "ArrowLeft" : "ArrowRight"
    const backward = rtl ? "ArrowRight" : "ArrowLeft"
    const at = (i: number) => rows[Math.max(0, Math.min(rows.length - 1, i))]

    switch (event.key) {
      case "ArrowDown":
        focusRow(keyOf(at(index + 1)))
        break
      case "ArrowUp":
        focusRow(keyOf(at(index - 1)))
        break
      case "Home":
        focusRow(keyOf(rows[0]))
        break
      case "End":
        focusRow(keyOf(rows[rows.length - 1]))
        break
      case forward:
        if (row.kind === "node" && row.node.expandable) {
          if (!expanded.has(row.node.key)) {
            toggle(row.node, true)
          } else if (rows[index + 1]) {
            focusRow(keyOf(rows[index + 1]))
          }
        }
        break
      case backward:
        if (row.kind === "node" && row.node.expandable && expanded.has(row.node.key)) {
          toggle(row.node, false)
        } else if (row.kind === "node" && row.parent) {
          focusRow(row.parent)
        }
        break
      case "Enter":
      case " ":
        if (row.kind === "node") {
          go(row.node)
        } else if (row.kind === "more") {
          void load(row.group, row.offset)
        }
        break
      default:
        return
    }

    event.preventDefault()
  }

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <InputGroup>
        <InputGroupAddon>{searching ? <Spinner /> : <Search />}</InputGroupAddon>
        <InputGroupInput
          aria-label={t("searchLabel")}
          placeholder={t("search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </InputGroup>
      {shownResults !== null ? (
        <div className="flex flex-col gap-1" aria-live="polite">
          <p className="text-xs text-muted-foreground">
            {shownResults.length === 0
              ? t("noMatch", { query: searchTerm })
              : t("results", { count: shownResults.length })}
          </p>
          <ul className="flex flex-col divide-y border bg-card">
            {shownResults.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-2 text-start text-sm hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
                    r.key === selected && "bg-primary/5"
                  )}
                  onClick={() => {
                    setQuery("")
                    router.push(accessResourceHref(r.key), { scroll: false })
                    onNavigate?.()
                  }}
                >
                  <TypeIcon type={r.type} className="mt-0.5 text-muted-foreground" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">
                      <bdi>{r.name}</bdi>
                      {r.detail ? (
                        <span className="font-normal text-muted-foreground"> · {r.detail}</span>
                      ) : null}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{r.path}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div role="tree" aria-label={t("label")} className="flex flex-col border bg-card py-1">
          {rows.map((row, index) => {
            const key = keyOf(row)
            const indent = { paddingInlineStart: `${(row.level - 1) * 1.1 + 0.5}rem` }

            if (row.kind === "loading") {
              return (
                <div
                  key={key}
                  role="treeitem"
                  aria-level={row.level}
                  aria-busy="true"
                  aria-selected={false}
                  className="flex items-center gap-2 py-1.5 pe-2 text-sm text-muted-foreground"
                  style={indent}
                >
                  {failed.has(key.replace("#loading", "")) ? (
                    t("error")
                  ) : (
                    <>
                      <Spinner className="size-3.5" />
                      {t("loading")}
                    </>
                  )}
                </div>
              )
            }

            if (row.kind === "more") {
              return (
                <div
                  key={key}
                  ref={(el) => void (el ? items.current.set(key, el) : items.current.delete(key))}
                  role="treeitem"
                  aria-level={row.level}
                  aria-selected={false}
                  tabIndex={focusKey === key ? 0 : -1}
                  onKeyDown={(e) => onKeyDown(e, index)}
                  onClick={() => void load(row.group, row.offset)}
                  onFocus={() => setFocusKey(key)}
                  className="flex cursor-pointer items-center gap-2 py-1.5 pe-2 text-xs font-semibold tracking-wider text-primary uppercase hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none"
                  style={indent}
                >
                  {loading.has(row.group) ? <Spinner className="size-3.5" /> : null}
                  {t("showMore")}
                </div>
              )
            }

            const { node } = row
            const open = expanded.has(node.key)
            const isSelected = node.key === selected
            const selectable = node.kind === "resource" && node.manageable

            return (
              <div
                key={key}
                ref={(el) => void (el ? items.current.set(key, el) : items.current.delete(key))}
                role="treeitem"
                aria-level={row.level}
                aria-posinset={row.pos}
                aria-setsize={row.size}
                aria-expanded={node.expandable ? open : undefined}
                aria-selected={isSelected}
                aria-current={isSelected ? "page" : undefined}
                tabIndex={focusKey === key ? 0 : -1}
                onKeyDown={(e) => onKeyDown(e, index)}
                onFocus={() => setFocusKey(key)}
                onClick={() => go(node)}
                className={cn(
                  "group/row relative flex min-h-9 cursor-pointer items-center gap-1.5 pe-2 text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset",
                  isSelected &&
                    "bg-primary/8 font-medium before:absolute before:inset-y-0 before:start-0 before:w-0.5 before:bg-primary",
                  !selectable && node.kind === "resource" && "text-muted-foreground"
                )}
                style={indent}
              >
                <span
                  className="flex size-5 shrink-0 items-center justify-center text-muted-foreground"
                  onClick={(e) => {
                    if (node.expandable) {
                      e.stopPropagation()
                      toggle(node)
                    }
                  }}
                  aria-hidden="true"
                >
                  {node.expandable ? (
                    <ChevronRight
                      className={cn(
                        "size-3.5 transition-transform rtl:-scale-x-100",
                        open && "rotate-90 rtl:-rotate-90"
                      )}
                    />
                  ) : null}
                </span>
                <TypeIcon
                  type={node.type}
                  className={cn(
                    "size-4",
                    node.kind === "group" ? "text-muted-foreground/70" : "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "flex min-w-0 flex-1 gap-x-1.5",
                    node.type === "session" ? "items-baseline" : "flex-col py-1"
                  )}
                >
                  <span
                    className={cn("truncate", node.kind === "group" && "text-muted-foreground")}
                  >
                    <bdi>{node.name}</bdi>
                  </span>
                  {node.detail ? (
                    <span className="truncate text-xs leading-tight text-muted-foreground">
                      {node.detail}
                    </span>
                  ) : null}
                </span>
                {node.kind === "group" && node.count !== null ? (
                  <span className="text-xs text-muted-foreground tabular-nums">{node.count}</span>
                ) : null}
                {node.kind === "resource" && node.direct > 0 && selectable ? (
                  <span
                    className="min-w-5 bg-muted px-1 text-center text-[0.65rem] font-semibold text-muted-foreground tabular-nums"
                    title={t("direct", { count: node.direct })}
                  >
                    {node.direct}
                    <span className="sr-only"> {t("direct", { count: node.direct })}</span>
                  </span>
                ) : null}
                {node.kind === "resource" && !node.manageable ? (
                  <Lock className="size-3 text-muted-foreground/70" aria-label={t("context")} />
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
