import { getTranslations } from "next-intl/server"

import { MemberShell } from "@/features/member/member-shell"

export async function generateMetadata() {
  const t = await getTranslations("member.meta")
  return { title: { default: t("title"), template: "%s · KHMK Köln" } }
}

export default function MemberLayout({ children }: LayoutProps<"/member">) {
  return <MemberShell>{children}</MemberShell>
}
