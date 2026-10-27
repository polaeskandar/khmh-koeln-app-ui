"use client"

/**
 * One person (09): name, where they belong, and recent attendance. Adapted
 * from the shadcnblocks "sheet-form-4" block (form in a side sheet with a
 * sticky footer). The person record stays deliberately minimal for the MVP.
 */
import { useState } from "react"
import { CircleOff, UserCheck } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { TextField } from "@/components/form-fields"
import { MemberAvatar } from "@/components/member-avatar"
import { ServiceSwatch } from "@/components/service-tag"
import { StatusBadge } from "@/components/status"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { useServerAction } from "@/hooks/use-server-action"
import { useInlineEnd } from "@/i18n/direction"
import { useFormat } from "@/i18n/format"
import {
  addMembershipAction,
  setPersonStatusAction,
  updatePersonAction,
} from "@/server/actions/people"
import type { MemberRow, MembersPage } from "@/server/queries/members"

import { MembershipMenu } from "./member-dialogs"

function NameForm({ row }: { row: MemberRow }) {
  const t = useTranslations("members")
  const [firstName, setFirstName] = useState(row.person.firstName)
  const [lastName, setLastName] = useState(row.person.lastName)
  const [displayName, setDisplayName] = useState(row.person.displayName ?? "")
  const save = useServerAction(updatePersonAction)
  const changed =
    firstName !== row.person.firstName ||
    lastName !== row.person.lastName ||
    (displayName || null) !== row.person.displayName
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        save.execute(row.person.id, { firstName, lastName, displayName: displayName || null })
      }}
    >
      <FieldGroup className="gap-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t("fields.firstName")}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            maxLength={80}
            error={save.fieldErrors.firstName}
          />
          <TextField
            label={t("fields.lastName")}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            maxLength={80}
            error={save.fieldErrors.lastName}
          />
        </div>
        <TextField
          label={t("fields.displayName")}
          optional
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={120}
          description={t("fields.displayNameHintShort")}
          error={save.fieldErrors.displayName}
        />
      </FieldGroup>
      {changed ? (
        <Button type="submit" size="sm" className="self-start" disabled={save.pending}>
          {save.pending ? <Spinner data-icon="inline-start" /> : null}
          {t("sheet.saveName")}
        </Button>
      ) : null}
    </form>
  )
}

function AddPlacement({ row, services }: { row: MemberRow; services: MembersPage["services"] }) {
  const t = useTranslations("members.sheet")
  const options = services.flatMap((s) => [
    ...(s.canManageServiceLevel
      ? [{ value: `${s.id}:`, label: t("serviceNoStage", { service: s.name }) }]
      : []),
    ...s.stages
      .filter((st) => st.canManageMembers)
      .map((st) => ({ value: `${s.id}:${st.id}`, label: `${s.name} · ${st.name}` })),
  ])
  const taken = new Set(row.placements.map((p) => `${p.service.id}:${p.stage?.id ?? ""}`))
  const free = options.filter((o) => !taken.has(o.value))
  const [value, setValue] = useState(free[0]?.value ?? "")
  const add = useServerAction(addMembershipAction)
  if (free.length === 0) return null
  return (
    <Field>
      <FieldLabel htmlFor="add-placement">{t("addTo")}</FieldLabel>
      <div className="flex gap-2">
        <NativeSelect
          id="add-placement"
          className="w-full"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          {free.map((o) => (
            <NativeSelectOption key={o.value} value={o.value}>
              {o.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button
          type="button"
          variant="outline"
          disabled={add.pending || !value}
          onClick={() => {
            const [serviceId, stageId] = value.split(":")
            add.execute(row.person.id, serviceId, stageId || null)
          }}
        >
          {add.pending ? <Spinner data-icon="inline-start" /> : null}
          {t("add")}
        </Button>
      </div>
    </Field>
  )
}

export function PersonSheet({
  row,
  services,
  onOpenChange,
}: {
  row: MemberRow | null
  services: MembersPage["services"]
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("members")
  const tc = useTranslations("common")
  const f = useFormat()
  // The sheet slides in from the side where lines end: the right, or the left in Arabic.
  const side = useInlineEnd()
  const [confirm, setConfirm] = useState(false)
  const status = useServerAction(setPersonStatusAction)
  const inactive = row?.person.status === "inactive"
  return (
    <Sheet open={!!row} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className="w-full gap-0 data-[side=left]:sm:max-w-lg data-[side=right]:sm:max-w-lg"
      >
        {row ? (
          <>
            <SheetHeader className="border-b p-5 pe-14">
              <div className="flex items-center gap-3">
                <MemberAvatar
                  name={row.person.name}
                  initials={row.person.initials}
                  seed={row.person.id}
                  className="size-11 text-sm"
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <SheetTitle className="truncate">{row.person.name}</SheetTitle>
                  <SheetDescription className="flex items-center gap-2">
                    {row.person.displayName ? row.person.fullName : t("sheet.member")}
                    {inactive ? (
                      <StatusBadge tone="muted" icon={CircleOff}>
                        {tc("inactive")}
                      </StatusBadge>
                    ) : null}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-5">
              {row.canEdit ? (
                <section className="flex flex-col gap-3" aria-label={t("name")}>
                  <NameForm
                    key={
                      row.person.id +
                      row.person.firstName +
                      row.person.lastName +
                      (row.person.displayName ?? "")
                    }
                    row={row}
                  />
                </section>
              ) : null}

              <section className="flex flex-col gap-3" aria-labelledby="belongs">
                <h3
                  id="belongs"
                  className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                >
                  {t("belongsTo")}
                </h3>
                {row.placements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("sheet.noServiceNow")}</p>
                ) : (
                  <ul className="divide-y border-y">
                    {row.placements.map((p) => {
                      const service = services.find((s) => s.id === p.service.id)
                      const where = p.stage ? `${p.service.name} · ${p.stage.name}` : p.service.name
                      return (
                        <li key={p.membershipId} className="flex items-center gap-3 py-2.5">
                          <ServiceSwatch tone={p.service.tone} className="size-2.5" />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium">{where}</span>
                            <span className="text-xs text-muted-foreground">
                              {t("sheet.since", { date: f.mediumDate(p.since) })}
                            </span>
                          </span>
                          {row.canEdit && !inactive ? (
                            <MembershipMenu
                              membershipId={p.membershipId}
                              personName={row.person.name}
                              where={p.stage?.name ?? p.service.name}
                              otherStages={(service?.stages ?? []).filter(
                                (st) => st.id !== p.stage?.id && st.canManageMembers
                              )}
                            />
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
                {row.canEdit && !inactive ? (
                  <AddPlacement key={row.placements.length} row={row} services={services} />
                ) : null}
              </section>

              {row.pastPlacements.length > 0 ? (
                <section className="flex flex-col gap-2" aria-labelledby="earlier">
                  <h3
                    id="earlier"
                    className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                  >
                    {t("sheet.earlier")}
                  </h3>
                  <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                    {row.pastPlacements.map((p) => (
                      <li key={p.membershipId}>
                        {t("sheet.pastPlacement", {
                          where: p.stage ? `${p.service.name} · ${p.stage.name}` : p.service.name,
                          from: f.mediumDate(p.since),
                          to: f.mediumDate(p.until),
                        })}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="flex flex-col gap-2" aria-labelledby="attended">
                <h3
                  id="attended"
                  className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                >
                  {t("sheet.recentlyPresent")}
                </h3>
                {row.recentAttendance.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("sheet.notPresentYet")}</p>
                ) : (
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {row.recentAttendance.map((a, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span className="truncate">
                          {a.group} · {a.title}
                        </span>
                        <span className="shrink-0 text-muted-foreground">{f.dayMonth(a.date)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("sheet.last4Weeks", { count: row.attendedLast4Weeks })}
                </p>
              </section>
            </div>
            {row.canEdit ? (
              <SheetFooter className="border-t p-4">
                <Button
                  variant="outline"
                  onClick={() =>
                    inactive ? status.execute(row.person.id, "active") : setConfirm(true)
                  }
                  disabled={status.pending}
                >
                  {inactive ? (
                    <UserCheck data-icon="inline-start" />
                  ) : (
                    <CircleOff data-icon="inline-start" />
                  )}
                  {inactive ? t("sheet.reactivate") : t("sheet.markInactive")}
                </Button>
              </SheetFooter>
            ) : null}
            <ConfirmDialog
              open={confirm}
              onOpenChange={setConfirm}
              title={t("sheet.inactiveTitle", { name: row.person.name })}
              description={t("sheet.inactiveDescription")}
              consequences={[
                t("sheet.inactiveConsequences.rosters"),
                t("sheet.inactiveConsequences.history"),
                t("sheet.inactiveConsequences.reactivate"),
              ]}
              confirmLabel={t("sheet.markInactive")}
              onConfirm={async () => (await status.execute(row.person.id, "inactive")).ok}
            />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
