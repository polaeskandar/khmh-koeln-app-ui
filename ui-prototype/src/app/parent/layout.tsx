import { getTranslations } from "next-intl/server"

import { ParentShell } from "@/features/parent/parent-shell"

export async function generateMetadata() {
  const t = await getTranslations("parent.meta")
  return { title: { default: t("title"), template: "%s · KHMK Köln" } }
}

export default function ParentLayout({ children }: LayoutProps<"/parent">) {
  return <ParentShell>{children}</ParentShell>
}
