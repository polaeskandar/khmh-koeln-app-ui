import Link from "next/link"
import { ChevronRight, Hourglass } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { MemberAvatar } from "@/components/member-avatar"
import { getFormat } from "@/i18n/server"
import { getParentAccount } from "@/server/queries/parent"
import { getParentContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("parent.nav")
  return { title: t("children") }
}

export default async function ParentChildrenPage() {
  const d = await getParentAccount(await getParentContext())
  const [t, tn, f] = await Promise.all([
    getTranslations("parent.children"),
    getTranslations("parent.nav"),
    getFormat(),
  ])
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          {tn("children")}
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground">{t("description")}</p>
      </header>

      {d.children.length === 0 ? (
        <p className="border border-dashed p-5 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {d.children.map((c) => (
            <li key={c.id}>
              <Link
                href={`/parent/homework?child=${c.id}`}
                className="flex items-center gap-4 border p-5 transition-colors hover:bg-muted/60"
              >
                <MemberAvatar
                  name={c.fullName}
                  initials={c.initials}
                  seed={c.id}
                  className="size-12 text-base"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-heading text-lg leading-tight font-semibold">
                    {c.fullName}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {c.stage ? `${c.stage}${c.service ? ` · ${c.service}` : ""}` : t("noClass")}
                  </span>
                  <span className="text-sm">
                    {c.toDo > 0
                      ? t.rich("toDo", {
                          count: c.toDo,
                          num: (chunks) => (
                            <span className="font-semibold tabular-nums">{chunks}</span>
                          ),
                        })
                      : t("nothingToDo")}
                    <span className="text-muted-foreground"> · {t("done", { count: c.done })}</span>
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {d.pending.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="pending">
          <h2 id="pending" className="font-heading text-base font-semibold tracking-tight">
            {t("pendingTitle")}
          </h2>
          <ul className="flex flex-col gap-2">
            {d.pending.map((p) => {
              const date = f.mediumDate(p.requestedAt.slice(0, 10))
              return (
                <li key={p.id} className="flex items-center gap-3 border border-dashed p-4 text-sm">
                  <Hourglass className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>
                    {p.childName
                      ? t("pending", { name: p.childName, date })
                      : t("pendingUnknown", { date })}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <p className="max-w-prose text-sm text-muted-foreground">{t("help")}</p>
    </div>
  )
}
