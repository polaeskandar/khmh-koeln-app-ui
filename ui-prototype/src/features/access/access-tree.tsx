"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Lock } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { Spinner } from "@/components/ui/spinner"
import type { TreeNode, TreePage } from "@/lib/view-models"
import { treeChildrenAction } from "@/server/actions/access"

import { TypeIcon } from "./labels"

type Row =
  | {
      kind: "node"
      node: TreeNode
      level: number
      parent: string | null
      pos: number
      size: number
    }
  | { kind: "more"; key: string; parent: string; level: number; offset: number }
  | { kind: "loading"; key: string; parent: string; level: number }

export type TreeProps = {
  root: TreeNode
  pages: Record<string, TreePage>
  expanded: string[]
  selected: string
  onNavigate?: () => void
  className?: string
}

/**
 * The church as a tree (WAI-ARIA tree pattern): ↑ ↓ move, → ← open and close (mirrored in
 * Arabic), Enter selects. Children load when a row opens; lessons, sessions and tasks come in a
 * group, ten at a time. Only the places where the viewer manages access are listed, with the
 * places above them greyed out.
 */
export function AccessTree({
  root,
  pages: initialPages,
  expanded: initialExpanded,
  selected,
  onNavigate,
  className,
}: TreeProps) {
  const t = useTranslations("access.tree")
  const router = useRouter()
  const [pages, setPages] = useState(initialPages)
  const [expanded, setExpanded] = useState(() => new Set(initialExpanded))
  const [failed, setFailed] = useState<Set<string>>(new Set())
  const [loadingMore, setLoadingMore] = useState<string | null>(null)
  const [focusKey, setFocusKey] = useState(selected)
  const [seen, setSeen] = useState(initialPages)
  const items = useRef(new Map<string, HTMLDivElement>())

  if (seen !== initialPages) {
    setSeen(initialPages)
    setPages((current) => ({ ...current, ...initialPages }))
    setExpanded((current) => new Set([...current, ...initialExpanded]))
    setFocusKey(selected)
  }

  const load = useCallback(async (key: string, offset: number) => {
    setFailed((s) => {
      const next = new Set(s)
      next.delete(key)

      return next
    })
    const result = await treeChildrenAction(key, offset)

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

  const toggle = (node: TreeNode, open = !expanded.has(node.key)) => {
    setExpanded((current) => {
      const next = new Set(current)

      if (open) {
        next.add(node.key)
      } else {
        next.delete(node.key)
      }

      return next
    })

    if (open && !pages[node.key]) {
      void load(node.key, 0)
    }
  }

  const rows = useMemo(() => {
    const out: Row[] = []
    const walk = (
      node: TreeNode,
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
        out.push({
          kind: "loading",
          key: `${node.key}#loading`,
          parent: node.key,
          level: level + 1,
        })

        return
      }

      page.nodes.forEach((child, i) => walk(child, level + 1, node.key, i + 1, page.nodes.length))

      if (page.next !== null) {
        out.push({
          kind: "more",
          key: `${node.key}#more`,
          parent: node.key,
          level: level + 1,
          offset: page.next,
        })
      }
    }
    walk(root, 1, null, 1, 1)

    return out
  }, [root, pages, expanded])

  const keyOf = (row: Row) => (row.kind === "node" ? row.node.key : row.key)

  const select = (node: TreeNode) => {
    if (!node.manageable) {
      toggle(node)

      return
    }

    if (node.expandable && !expanded.has(node.key)) {
      toggle(node, true)
    }

    router.push(node.href, { scroll: false })
    onNavigate?.()
  }

  const more = async (row: Extract<Row, { kind: "more" }>) => {
    setLoadingMore(row.parent)
    await load(row.parent, row.offset)
    setLoadingMore(null)
  }

  const focusRow = (key: string) => {
    setFocusKey(key)
    items.current.get(key)?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const row = rows[index]
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl"
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
      case rtl ? "ArrowLeft" : "ArrowRight":
        if (row.kind === "node" && row.node.expandable) {
          if (!expanded.has(row.node.key)) {
            toggle(row.node, true)
          } else if (rows[index + 1]) {
            focusRow(keyOf(rows[index + 1]))
          }
        }
        break
      case rtl ? "ArrowRight" : "ArrowLeft":
        if (row.kind === "node" && row.node.expandable && expanded.has(row.node.key)) {
          toggle(row.node, false)
        } else if (row.parent) {
          focusRow(row.parent)
        }
        break
      case "Enter":
      case " ":
        if (row.kind === "node") {
          select(row.node)
        } else if (row.kind === "more") {
          void more(row)
        }
        break
      default:
        return
    }

    event.preventDefault()
  }

  const register = (key: string) => (el: HTMLDivElement | null) => {
    if (el) {
      items.current.set(key, el)
    } else {
      items.current.delete(key)
    }
  }

  return (
    <div
      role="tree"
      aria-label={t("label")}
      className={cn("flex flex-col border bg-card py-1", className)}
    >
      {rows.map((row, index) => {
        const key = keyOf(row)
        const indent = { paddingInlineStart: `${(row.level - 1) * 1.1 + 0.5}rem` }

        if (row.kind === "loading") {
          return (
            <div
              key={key}
              role="treeitem"
              aria-level={row.level}
              aria-selected={false}
              aria-busy="true"
              className="flex items-center gap-2 py-1.5 pe-2 text-sm text-muted-foreground"
              style={indent}
            >
              {failed.has(row.parent) ? (
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
              ref={register(key)}
              role="treeitem"
              aria-level={row.level}
              aria-selected={false}
              tabIndex={focusKey === key ? 0 : -1}
              onKeyDown={(e) => onKeyDown(e, index)}
              onFocus={() => setFocusKey(key)}
              onClick={() => void more(row)}
              className="flex cursor-pointer items-center gap-2 py-1.5 pe-2 text-xs font-semibold tracking-wider text-primary uppercase hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none"
              style={indent}
            >
              {loadingMore === row.parent ? <Spinner className="size-3.5" /> : null}
              {t("showMore")}
            </div>
          )
        }

        const { node } = row
        const open = expanded.has(node.key)
        const isSelected = node.key === selected

        return (
          <div
            key={key}
            ref={register(key)}
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
            onClick={() => select(node)}
            className={cn(
              "relative flex min-h-9 cursor-pointer items-center gap-1.5 pe-2 text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset",
              isSelected &&
                "bg-primary/8 font-medium before:absolute before:inset-y-0 before:start-0 before:w-0.5 before:bg-primary",
              !node.manageable && "text-muted-foreground"
            )}
            style={indent}
          >
            <span
              className="flex size-5 shrink-0 items-center justify-center text-muted-foreground"
              aria-hidden="true"
              onClick={(e) => {
                if (node.expandable) {
                  e.stopPropagation()
                  toggle(node)
                }
              }}
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
              className={
                node.kind === "group" ? "text-muted-foreground/70" : "text-muted-foreground"
              }
            />
            <span
              className={cn(
                "flex min-w-0 flex-1 gap-x-1.5",
                node.type === "session" ? "items-baseline" : "flex-col py-1"
              )}
            >
              <span className="truncate">
                <bdi>{node.name}</bdi>
              </span>
              {node.detail ? (
                <span className="truncate text-xs leading-tight text-muted-foreground">
                  {node.detail}
                </span>
              ) : null}
            </span>
            {node.count !== null ? (
              <span className="text-xs text-muted-foreground tabular-nums">{node.count}</span>
            ) : null}
            {node.manageable ? null : (
              <Lock className="size-3 text-muted-foreground/70" aria-label={t("notYours")} />
            )}
          </div>
        )
      })}
    </div>
  )
}
