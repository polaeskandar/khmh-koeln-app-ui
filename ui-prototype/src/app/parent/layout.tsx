import { getTranslations } from "next-intl/server"

import { PortalShell } from "@/components/portal/portal-shell"
import { getParentContext, getShellData } from "@/server/request"

export async function generateMetadata() {
  return {
    title: {
      default: (await getTranslations("portal"))("parentTitle"),
      template: "%s · KHMK Köln",
    },
  }
}

export default async function ParentLayout({ children }: LayoutProps<"/parent">) {
  await getParentContext()
  const shell = await getShellData()
  const t = await getTranslations("portal")

  return (
    <PortalShell
      base="/parent"
      viewer={shell.viewer}
      personas={shell.personas}
      title={t("parentTitle")}
    >
      {children}
    </PortalShell>
  )
}
