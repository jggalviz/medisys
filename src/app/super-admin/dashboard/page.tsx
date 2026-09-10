import { getSuperAdminSnapshot } from "@/app/actions/super-admin"
import { SuperAdminDashboard } from "@/components/super-admin/SuperAdminDashboard"

export default async function SuperAdminDashboardPage() {
  const resultado = await getSuperAdminSnapshot()
  if (!resultado.ok) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
        {resultado.message}
      </div>
    )
  }
  return <SuperAdminDashboard snapshot={resultado.data} />
}
