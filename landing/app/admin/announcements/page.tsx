import { AdminWorkspace } from "@/src/features/culture/ui/admin-workspace"
export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; from?: string; q?: string }>
}) {
  return <AdminWorkspace section="announcements" searchParams={searchParams} />
}
