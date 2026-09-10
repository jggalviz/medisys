import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"

import { ShieldAlert } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { getStaffForSlug } from "@/lib/staff"
import { getTenantBySlug } from "@/app/actions/tenant"
import { EspecialistasManager } from "@/components/admin/especialistas/EspecialistasManager"

export const metadata: Metadata = {
  title: "Especialistas y horarios | Medisys",
  robots: { index: false },
}

type Props = {
  params: Promise<{ clinicSlug: string }>
}

export default async function EspecialistasPage({ params }: Props) {
  const { clinicSlug } = await params
  const tenant = await getTenantBySlug(clinicSlug)

  if (!tenant) notFound()

  const supabase = await createClient()
  const staff = await getStaffForSlug(supabase, clinicSlug)
  if (!staff) redirect(`/${clinicSlug}/login`)

  if (staff.role !== "admin" && staff.role !== "recepcion") {
    return (
      <main className="min-h-dvh bg-muted/30">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
          <Link
            href={`/${clinicSlug}/admin`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Volver al panel
          </Link>
          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card p-8 text-center">
            <ShieldAlert className="size-8 text-amber-600" />
            <p className="text-lg font-semibold">Acceso restringido</p>
            <p className="text-sm text-muted-foreground">
              Solo administradores y recepción pueden gestionar especialistas.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-muted/30">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <Link
          href={`/${clinicSlug}/admin`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Volver al panel
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Especialistas y horarios
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestiona el equipo médico de {tenant.nombre} y su disponibilidad.
        </p>

        <EspecialistasManager
          tenantId={tenant.id}
          planType={tenant.plan_type}
          maxEspecialistas={tenant.max_especialistas}
        />
      </div>
    </main>
  )
}
