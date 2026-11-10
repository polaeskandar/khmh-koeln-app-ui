"use client"

/**
 * The servants of a service, on its page: the accounts assigned to the whole service (its
 * leaders) and to its stages. Administrators and the service's leaders assign and take out;
 * everyone else only sees who serves (polaeskandar/khmh-koeln-app-backend#318).
 */
import { useState } from "react"
import { Plus, X } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { MemberAvatar } from "@/components/member-avatar"
import { Section } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { type GroupOption, GroupFields } from "@/features/assignments/group-choice"
import { useServerAction } from "@/hooks/use-server-action"
import { assignGroupAction, removeAssignmentAction } from "@/server/actions/accounts"
import type { ServiceServants } from "@/server/queries/services"

type Servant = ServiceServants["rows"][number]
type ServantGroup = Servant["groups"][number]

function AssignServantDialog({
  service,
  accounts,
  open,
  onOpenChange,
}: {
  service: GroupOption
  accounts: ServiceServants["accounts"]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("services.detail.servants")
  const ta = useTranslations("assignments")
  const tc = useTranslations("common")
  const [userId, setUserId] = useState("")
  const [stageId, setStageId] = useState<string | null>(null)
  const assign = useServerAction(assignGroupAction, { onSuccess: () => onOpenChange(false) })
  return (
    <Dialog open={open} onOpenChange={(next) => !assign.pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pe-8 leading-snug">
            {t("dialog.title", { service: service.name })}
          </DialogTitle>
          <DialogDescription>{ta("dialog.description")}</DialogDescription>
        </DialogHeader>
        <form
          id={`assign-servant-${service.id}`}
          onSubmit={(e) => {
            e.preventDefault()
            assign.execute(userId, { serviceId: service.id, stageId })
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`servant-${service.id}`}>{t("dialog.account")}</FieldLabel>
              <NativeSelect
                id={`servant-${service.id}`}
                className="w-full"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              >
                <NativeSelectOption value="" disabled>
                  {t("dialog.chooseAccount")}
                </NativeSelectOption>
                {accounts.map((a) => (
                  <NativeSelectOption key={a.id} value={a.id}>
                    {a.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <GroupFields
              services={[service]}
              value={{ serviceId: service.id, stageId }}
              onChange={(v) => setStageId(v.stageId)}
              errors={assign.fieldErrors}
              fixedService
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={assign.pending}>
            {tc("cancel")}
          </Button>
          <Button
            type="submit"
            form={`assign-servant-${service.id}`}
            disabled={assign.pending || !userId}
          >
            {assign.pending ? <Spinner data-icon="inline-start" /> : null}
            {ta("assign")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ServantsSection({
  service,
  servants,
}: {
  service: GroupOption
  servants: ServiceServants
}) {
  const t = useTranslations("services.detail.servants")
  const ta = useTranslations("assignments")
  const [assigning, setAssigning] = useState(false)
  const [leaving, setLeaving] = useState<{ servant: Servant; group: ServantGroup } | null>(null)
  const remove = useServerAction(removeAssignmentAction)
  const where = (g: ServantGroup) => g.stage?.name ?? ta("wholeService")
  return (
    <Section
      id="servants"
      title={t("title")}
      description={t("description")}
      actions={
        servants.canAssign ? (
          <Button variant="ghost" size="sm" onClick={() => setAssigning(true)}>
            <Plus data-icon="inline-start" />
            {t("assign")}
          </Button>
        ) : null
      }
    >
      {servants.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y border-y">
          {servants.rows.map((servant) => (
            <li key={servant.id} className="flex items-start gap-3 py-3">
              <MemberAvatar name={servant.name} initials={servant.initials} seed={servant.id} />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="truncate text-sm font-medium">{servant.name}</span>
                <span className="flex flex-wrap gap-1.5">
                  {servant.groups.map((g) => (
                    <span
                      key={g.id}
                      className="inline-flex h-6 items-center gap-1.5 border px-2 text-xs text-muted-foreground"
                    >
                      <bdi>{where(g)}</bdi>
                      {g.canRemove ? (
                        <button
                          type="button"
                          className="-me-1 hover:text-foreground"
                          aria-label={ta("removeLabel", { name: servant.name, where: where(g) })}
                          onClick={() => setLeaving({ servant, group: g })}
                        >
                          <X className="size-3.5" />
                        </button>
                      ) : null}
                    </span>
                  ))}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {assigning ? (
        <AssignServantDialog
          service={service}
          accounts={servants.accounts}
          open
          onOpenChange={setAssigning}
        />
      ) : null}
      <ConfirmDialog
        open={!!leaving}
        onOpenChange={(open) => !open && setLeaving(null)}
        title={
          leaving
            ? ta("removeTitle", {
                name: leaving.servant.name,
                where: leaving.group.stage
                  ? `${service.name} · ${leaving.group.stage.name}`
                  : service.name,
              })
            : ""
        }
        description={ta("removeDescription")}
        tone="destructive"
        confirmLabel={ta("remove")}
        onConfirm={async () => (leaving ? (await remove.execute(leaving.group.id)).ok : true)}
      />
    </Section>
  )
}
