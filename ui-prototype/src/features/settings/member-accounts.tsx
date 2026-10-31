"use client"

/**
 * Member accounts (administrators only): accounts linked to a member's own
 * record, so the person sees their groups and homework in the member portal.
 * An administrator sets the link when approving the account, after checking
 * who it belongs to; under 16 only with a parent's or guardian's agreement.
 * Removing the link takes the member portal away; the account stays.
 */
import { useState } from "react"
import { Unlink, UserRound } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { MemberAvatar } from "@/components/member-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useServerAction } from "@/hooks/use-server-action"
import { useFormat } from "@/i18n/format"
import type { LocalDate } from "@/lib/domain/types"
import { unlinkMemberAction } from "@/server/actions/accounts"
import type { MemberAccount } from "@/server/queries/settings"

const initialsOf = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()

export function MemberAccounts({
  accounts,
  today,
}: {
  accounts: MemberAccount[]
  today: LocalDate
}) {
  const t = useTranslations("settings.members")
  const f = useFormat()
  const [removing, setRemoving] = useState<MemberAccount | null>(null)
  const unlink = useServerAction(unlinkMemberAction)

  if (accounts.length === 0) {
    return (
      <p className="flex items-center gap-2 border border-dashed p-4 text-sm text-muted-foreground">
        <UserRound className="size-4 shrink-0" aria-hidden="true" />
        {t("empty")}
      </p>
    )
  }

  return (
    <>
      <ul className="divide-y border-y">
        {accounts.map((a) => (
          <li key={a.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-start">
            <div className="flex min-w-0 flex-1 gap-3">
              <MemberAvatar name={a.name} initials={initialsOf(a.name)} seed={a.id} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{a.name}</span>
                  {a.isParent ? <Badge variant="outline">{t("alsoParent")}</Badge> : null}
                  {a.disabled ? <Badge variant="outline">{t("disabled")}</Badge> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  <bdi dir="ltr">{a.email}</bdi>
                </p>
                <p className="text-sm">
                  {t.rich("record", {
                    name: a.member.name,
                    strong: (chunks) => <span className="font-medium">{chunks}</span>,
                  })}
                  {" · "}
                  {a.member.inactive
                    ? t("inactive")
                    : a.member.groups.length > 0
                      ? f.list(a.member.groups)
                      : t("noGroup")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[
                    a.ageCheck === "sixteenOrOlder"
                      ? t("sixteenOrOlder")
                      : a.ageCheck === "guardianConsent"
                        ? a.guardianConsentNote
                          ? t("guardianConsentNote", { note: a.guardianConsentNote })
                          : t("guardianConsent")
                        : t("linkedByOffice"),
                    a.approvedAt
                      ? a.approvedBy
                        ? t("approvedBy", {
                            when: f.atLabel(a.approvedAt, today),
                            name: a.approvedBy,
                          })
                        : t("approved", { when: f.atLabel(a.approvedAt, today) })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 md:pt-0.5">
              <Button size="sm" variant="outline" onClick={() => setRemoving(a)}>
                <Unlink data-icon="inline-start" />
                {t("remove")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing ? t("removeTitle", { member: removing.member.name }) : ""}
        description={t("removeDescription")}
        consequences={[t("removeKept"), t("removeAgain")]}
        confirmLabel={t("removeConfirm")}
        tone="destructive"
        onConfirm={async () => (removing ? (await unlink.execute(removing.id)).ok : true)}
      />
    </>
  )
}
