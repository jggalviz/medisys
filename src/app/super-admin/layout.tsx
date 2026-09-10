import Link from "next/link"
import { redirect } from "next/navigation"

import { SuperAdminLogoutButton } from "@/components/super-admin/SuperAdminLogoutButton"
import { getSuperAdmin } from "@/lib/super-admin"

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const sesion = await getSuperAdmin()
  if (!sesion) {
    redirect("/login?next=/super-admin/dashboard")
  }

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <span className="font-semibold tracking-tight">
              🛡️ Super Admin · Medisys
            </span>
            <nav className="flex items-center gap-3 text-sm">
              <Link
                href="/super-admin/dashboard"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Dashboard
              </Link>
              <Link
                href="/super-admin/nuevo-cliente"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Nuevo cliente
              </Link>
              <Link
                href="/super-admin/pagos"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Pagos
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {sesion.email && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {sesion.email}
              </span>
            )}
            <SuperAdminLogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  )
}
