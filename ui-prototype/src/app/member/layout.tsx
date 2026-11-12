import { getTranslations } from "next-intl/server"

import { PortalShell } from "@/components/portal/portal-shell"
import { getMemberContext, getShellData } from "@/server/request"

export async function generateMetadata() {
  return {
    title: {
      default: (await getTranslations("portal"))("memberTitle"),
      template: "%s · KHMK Köln",
    },
  }
}

export default async function MemberLayout({ children }: LayoutProps<"/member">) {
  await getMemberContext()
  const shell = await getShellData()
  const t = await getTranslations("portal")

  return (
    <PortalShell
      base="/member"
      viewer={shell.viewer}
      personas={shell.personas}
      title={t("memberTitle")}
    >
      {children}
    </PortalShell>
  )
}
