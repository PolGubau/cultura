import { AdminWorkspace } from "@/src/features/culture/ui/admin-workspace"
export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; q?: string }>
}) {
  return <AdminWorkspace section="categories" searchParams={searchParams} />
}
