import { getTranslations } from "next-intl/server"

import { LessonGrid } from "@/components/portal/portal-home"
import { getMemberHome } from "@/server/queries/portals"
import { getMemberContext } from "@/server/request"

export async function generateMetadata() {
  return { title: (await getTranslations("portal.nav"))("lessons") }
}

export default async function MemberLessonsPage() {
  const data = getMemberHome(await getMemberContext())
  const t = await getTranslations("portal")

  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">{t("lessonsTitle")}</h1>
      <LessonGrid lessons={data.lessons} hrefFor={(id) => `/member/lessons/${id}`} />
    </>
  )
}
