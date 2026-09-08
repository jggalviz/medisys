import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { LogOut } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { getStaffForSlug } from "@/lib/staff"
import { signOutStaff } from "@/app/actions/auth"
import { Badge } from "@/components/ui/badge"
import type { TenantUserRole } from "@/types/database"

const ETIQUETA_ROL: Record<TenantUserRole, string> = {
  admin: "Administrador",
  recepcion: "Recepción",
  especialista: "Especialista",
}

type Props = {
  children: ReactNode
  params: Promise<{ clinicSlug: string }>
}

export default async function AdminLayout({ children, params }: Props) {
  const { clinicSlug } = await params

  const supabase = await createClient()
  const staff = await getStaffForSlug(supabase, clinicSlug)

  // Doble seguro: el proxy ya protege, pero si aquí no hay staff → login.
  if (!staff) {
    redirect(`/${clinicSlug}/login`)
  }

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-bold tracking-tight">
              {staff.tenantNombre}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {staff.email ?? "Personal"}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {ETIQUETA_ROL[staff.role]}
            </Badge>
            <form action={signOutStaff.bind(null, clinicSlug)}>
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors hover:bg-muted/60"
              >
                <LogOut className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Cerrar Sesión</span>
                <span className="sm:hidden">Salir</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {children}
    </div>
  )
}
