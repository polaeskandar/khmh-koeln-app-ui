import { AppShell } from "@/components/app-shell/app-shell"
import { getShellData, getStaffContext } from "@/server/request"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await getStaffContext()
  const shell = await getShellData()

  return <AppShell shell={shell}>{children}</AppShell>
}
