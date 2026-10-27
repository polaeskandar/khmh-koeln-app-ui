"use client"

/**
 * Stage list with drag-and-drop ordering, adapted from the shadcnblocks Pro
 * block "data-table17" (draggable rows, dnd-kit). Kept: sortable rows with a
 * grip handle, mouse, touch and keyboard sensors, vertical-axis restriction.
 * Changed: the order is saved (optimistically) and every row also offers
 * "Move up / Move down", so ordering never depends on dragging alone.
 */
import { useMemo, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import type { Announcements, DragEndEvent, UniqueIdentifier } from "@dnd-kit/core"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Archive, GripVertical } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { StatusBadge } from "@/components/status"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useServerAction } from "@/hooks/use-server-action"
import { useFormat } from "@/i18n/format"
import { reorderStagesAction } from "@/server/actions/services"
import type { StageRow } from "@/server/queries/services"
import { isolate } from "@/lib/bidi"

import { StageActionsMenu } from "./stage-dialogs"

const noSubscription = () => () => {}

type Props = {
  service: { id: string; name: string }
  stages: StageRow[]
  archived: (StageRow & { archivedAt: string | null })[]
  canManage: boolean
}

function SortableStageRow({
  stage,
  index,
  count,
  service,
  canManage,
  interactive,
  onMove,
}: {
  stage: StageRow
  index: number
  count: number
  service: Props["service"]
  canManage: boolean
  interactive: boolean
  onMove: (id: string, direction: -1 | 1) => void
}) {
  const t = useTranslations("stages")
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
    disabled: !canManage,
  })
  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "relative z-10 bg-muted/80 shadow-sm")}
    >
      <TableCell className="w-12 ps-3">
        {canManage ? (
          <button
            type="button"
            className="flex size-8 cursor-grab items-center justify-center text-muted-foreground hover:bg-muted active:cursor-grabbing"
            {...(interactive ? attributes : {})}
            {...(interactive ? (listeners ?? {}) : {})}
            tabIndex={interactive ? 0 : -1}
            aria-label={t("manager.dragHandle", { name: stage.name })}
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}
      </TableCell>
      <TableCell className="w-10 text-muted-foreground tabular-nums">{index + 1}</TableCell>
      <TableCell>
        <div className="flex min-w-0 flex-col py-1">
          <Link
            href={`/services/${service.id}/stages/${stage.id}`}
            className="font-medium hover:underline hover:underline-offset-4"
          >
            {stage.name}
          </Link>
          {stage.description ? (
            <span dir="auto" className="truncate text-xs text-muted-foreground">
              {stage.description}
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="tabular-nums">{stage.members}</TableCell>
      <TableCell className="text-sm">
        {stage.meets ?? <span className="text-muted-foreground">{t("noSchedule")}</span>}
      </TableCell>
      <TableCell className="tabular-nums">{stage.sessions}</TableCell>
      <TableCell className="w-14 pe-3 text-end">
        {canManage ? (
          <StageActionsMenu
            serviceId={service.id}
            serviceName={service.name}
            stage={{ id: stage.id, name: stage.name, description: stage.description }}
            archived={false}
            members={stage.members}
            sessions={stage.sessions}
            deleteBlocker={stage.deleteBlocker}
            onMove={(direction) => onMove(stage.id, direction)}
            canMoveUp={index > 0}
            canMoveDown={index < count - 1}
          />
        ) : null}
      </TableCell>
    </TableRow>
  )
}

export function StagesManager({ service, stages, archived, canManage }: Props) {
  const t = useTranslations("stages")
  const tc = useTranslations("common")
  const f = useFormat()
  const [order, setOrder] = useState(() => stages.map((s) => s.id))
  const reorder = useServerAction(reorderStagesAction, { toastOnSuccess: false })
  const byId = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages])
  // Drag handles only work after hydration; until then they are inert.
  const mounted = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false
  )

  // Re-sync with the server's order whenever the stage list changes (add, archive, restore).
  const key = stages.map((s) => s.id).join()
  const [syncedKey, setSyncedKey] = useState(key)
  if (key !== syncedKey) {
    setSyncedKey(key)
    setOrder(key ? key.split(",") : [])
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const save = (next: string[]) => {
    const previous = order
    setOrder(next)
    reorder.execute(service.id, next).then((r) => {
      if (!r.ok) setOrder(previous)
    })
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = order.indexOf(String(active.id))
    const to = order.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    save(arrayMove(order, from, to))
  }

  const move = (id: string, direction: -1 | 1) => {
    const from = order.indexOf(id)
    const to = from + direction
    if (to < 0 || to >= order.length) return
    save(arrayMove(order, from, to))
  }

  const rows = order.map((id) => byId.get(id)).filter((s): s is StageRow => !!s)

  // What screen readers hear while a row is dragged with the keyboard: names and positions, not ids.
  const nameOf = (id: UniqueIdentifier) => byId.get(String(id))?.name ?? String(id)
  const at = (id: UniqueIdentifier) => ({
    position: order.indexOf(String(id)) + 1,
    total: order.length,
  })
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t("manager.announce.pickedUp", { name: nameOf(active.id), ...at(active.id) }),
    onDragOver: ({ active, over }) =>
      over ? t("manager.announce.moved", { name: nameOf(active.id), ...at(over.id) }) : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t("manager.announce.dropped", { name: nameOf(active.id), ...at(over.id) })
        : t("manager.announce.canceled", { name: nameOf(active.id) }),
    onDragCancel: ({ active }) => t("manager.announce.canceled", { name: nameOf(active.id) }),
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="overflow-x-auto border">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={onDragEnd}
          accessibility={{
            screenReaderInstructions: { draggable: t("manager.instructions") },
            announcements,
          }}
        >
          <Table className="min-w-[720px]">
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 ps-3">
                  <span className="sr-only">{t("manager.columns.order")}</span>
                </TableHead>
                <TableHead className="w-10">{t("manager.columns.position")}</TableHead>
                <TableHead>{t("manager.columns.stage")}</TableHead>
                <TableHead className="w-24">{t("manager.columns.members")}</TableHead>
                <TableHead>{t("manager.columns.meets")}</TableHead>
                <TableHead className="w-24">{t("manager.columns.sessions")}</TableHead>
                <TableHead className="w-14 pe-3">
                  <span className="sr-only">{t("manager.columns.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {t("manager.empty", { name: service.name })}
                  </TableCell>
                </TableRow>
              ) : (
                <SortableContext items={order} strategy={verticalListSortingStrategy}>
                  {rows.map((stage, index) => (
                    <SortableStageRow
                      key={stage.id}
                      stage={stage}
                      index={index}
                      count={rows.length}
                      service={service}
                      canManage={canManage}
                      interactive={mounted}
                      onMove={move}
                    />
                  ))}
                </SortableContext>
              )}
            </TableBody>
          </Table>
        </DndContext>
      </div>

      {archived.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="archived-stages">
          <h2 id="archived-stages" className="font-heading text-base font-semibold tracking-tight">
            {t("manager.archived")}
          </h2>
          <ul className="divide-y border-y">
            {archived.map((stage) => (
              <li key={stage.id} className="flex items-center gap-3 py-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2">
                    <Link
                      href={`/services/${service.id}/stages/${stage.id}`}
                      className="font-medium text-muted-foreground hover:underline hover:underline-offset-4"
                    >
                      {stage.name}
                    </Link>
                    <StatusBadge tone="muted" icon={Archive}>
                      {stage.archivedAt
                        ? t("archivedOn", { date: f.mediumDate(stage.archivedAt.slice(0, 10)) })
                        : tc("archived")}
                    </StatusBadge>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {stage.description ? `${isolate(stage.description)} · ` : ""}
                    {t("pastSessions", { count: stage.sessions })}
                  </span>
                </span>
                {canManage ? (
                  <StageActionsMenu
                    serviceId={service.id}
                    serviceName={service.name}
                    stage={{ id: stage.id, name: stage.name, description: stage.description }}
                    archived
                    members={stage.members}
                    sessions={stage.sessions}
                    deleteBlocker={stage.deleteBlocker}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
