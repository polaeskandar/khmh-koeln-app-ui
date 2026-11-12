import { getTranslations } from "next-intl/server"

import { ChildSwitcher } from "@/components/portal/portal-bits"
import { LessonGrid } from "@/components/portal/portal-home"
import { getParentHome } from "@/server/queries/portals"
import { getParentContext } from "@/server/request"

export async function generateMetadata() {
  return { title: (await getTranslations("portal.nav"))("lessons") }
}

export default async function ParentLessonsPage({ searchParams }: PageProps<"/parent/lessons">) {
  const query = await searchParams
  const data = getParentHome(
    await getParentContext(),
    typeof query.child === "string" ? query.child : null
  )
  const t = await getTranslations("portal")
  const q = data.child ? `?child=${data.child.id}` : ""

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{t("lessonsTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {data.child ? t("lessonsFor", { name: data.child.firstName }) : t("noChildren")}
        </p>
      </div>
      <ChildSwitcher
        kids={data.children}
        selected={data.child?.id ?? null}
        hrefFor={(id) => `/parent/lessons?child=${id}`}
      />
      <LessonGrid lessons={data.lessons} hrefFor={(id) => `/parent/lessons/${id}${q}`} />
    </>
  )
}
