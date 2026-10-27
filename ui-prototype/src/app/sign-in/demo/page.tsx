import { Suspense } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronRight, FlaskConical } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { MemberAvatar } from "@/components/member-avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { AuthFrame, AuthHeading } from "@/features/auth/auth-frame"
import type { ViewerInfo } from "@/lib/view-models"
import { signInAsAction } from "@/server/actions/prototype"
import { getDemoAccounts } from "@/server/queries/accounts"

export async function generateMetadata() {
  const t = await getTranslations("auth.demo")
  return { title: t("title") }
}

function Account({ p }: { p: ViewerInfo }) {
  return (
    <li>
      <form action={signInAsAction.bind(null, p.id)}>
        <button
          type="submit"
          className="flex w-full items-center gap-3 border p-3 text-start transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <MemberAvatar name={p.name} initials={p.initials} seed={p.id} />
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-sm font-medium">{p.name}</span>
            <span className="truncate text-xs text-muted-foreground">{p.roleSummary}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </form>
    </li>
  )
}

async function Accounts() {
  const [t, accounts] = await Promise.all([getTranslations("auth.demo"), getDemoAccounts()])
  const groups = [
    { title: t("staff"), hint: t("staffHint"), items: accounts.filter((p) => p.isStaff) },
    {
      title: t("parents"),
      hint: t("parentsHint"),
      items: accounts.filter((p) => !p.isStaff && p.isParent),
    },
  ]
  return (
    <div className="grid gap-8 md:grid-cols-2">
      {groups.map((g) => (
        <section key={g.title} className="flex flex-col gap-3" aria-label={g.title}>
          <div className="flex flex-col gap-0.5">
            <h2 className="font-heading text-base font-semibold tracking-tight">{g.title}</h2>
            <p className="text-xs text-muted-foreground">{g.hint}</p>
          </div>
          <ul className="flex flex-col gap-2">
            {g.items.map((p) => (
              <Account key={p.id} p={p} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** Prototype shortcut: sign in as one of the demo accounts without typing. */
export default async function DemoSignInPage() {
  const t = await getTranslations("auth.demo")
  return (
    <AuthFrame className="md:max-w-5xl">
      <Link
        href="/sign-in"
        className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("back")}
      </Link>
      <AuthHeading title={t("title")}>
        <p className="flex max-w-prose items-start gap-2">
          <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t("intro")}
        </p>
      </AuthHeading>
      <Suspense
        fallback={
          <div className="grid gap-8 md:grid-cols-2">
            <Skeleton className="h-96" />
            <Skeleton className="h-60" />
          </div>
        }
      >
        <Accounts />
      </Suspense>
    </AuthFrame>
  )
}
