import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"

import { ShieldAlert } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { getStaffForSlug } from "@/lib/staff"
import { getTenantBySlug } from "@/app/actions/tenant"
import { TenantSettings } from "@/components/admin/configuracion/TenantSettings"

export const metadata: Metadata = {
  title: "Configuración | Medisys",
  robots: { index: false },
}

type Props = {
  params: Promise<{ clinicSlug: string }>
}

export default async function ConfiguracionPage({ params }: Props) {
  const { clinicSlug } = await params
  const tenant = await getTenantBySlug(clinicSlug)

  if (!tenant) {
    notFound()
  }

  const supabase = await createClient()
  const staff = await getStaffForSlug(supabase, clinicSlug)

  if (!staff) {
    redirect(`/${clinicSlug}/login`)
  }

  // Solo el rol 'admin' puede ingresar y modificar la configuración.
  if (staff.role !== "admin") {
    return (
      <main className="min-h-dvh bg-muted/30">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
          <Link
            href={`/${clinicSlug}/admin`}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Volver al panel
          </Link>
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-dashed bg-card p-8 text-center">
            <ShieldAlert className="mx-auto size-8 text-amber-600" />
            <p className="text-lg font-semibold">Acceso restringido</p>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              La configuración del tenant está disponible únicamente para el
              rol <strong>Administrador</strong>. Tu usuario tiene el rol{" "}
              {staff.role}.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-muted/30">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Link
          href={`/${clinicSlug}/admin`}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Volver al panel
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Configuración del tenant
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administra la información y operación de {tenant.nombre}.
        </p>

        <TenantSettings tenant={tenant} />
      </div>
    </main>
  )
}
