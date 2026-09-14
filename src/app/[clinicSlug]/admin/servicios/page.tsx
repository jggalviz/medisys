import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"

import { ShieldAlert } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { getStaffForSlug } from "@/lib/staff"
import { getTenantBySlug } from "@/app/actions/tenant"
import { listarServicios } from "@/lib/admin/servicios"
import { getTasaVigente } from "@/lib/currency-rates"
import { tienePermiso } from "@/lib/rbac"
import { ServiciosManager } from "@/components/admin/servicios/ServiciosManager"
import { EnlaceGuia } from "@/components/admin/guia/EnlaceGuia"

/**
 * Catálogo de servicios médicos y honorarios (módulo de administración).
 * Los datos se leen en el servidor (RLS + sesión del staff) y se hidratan en
 * el componente cliente, que luego opera contra `/api/admin/services`.
 */
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Servicios y honorarios | Medisys",
  robots: { index: false },
}

type Props = {
  params: Promise<{ clinicSlug: string }>
}

export default async function ServiciosPage({ params }: Props) {
  const { clinicSlug } = await params
  const tenant = await getTenantBySlug(clinicSlug)

  if (!tenant) notFound()

  const supabase = await createClient()
  const staff = await getStaffForSlug(supabase, clinicSlug)

  if (!staff) redirect(`/${clinicSlug}/login`)

  if (!tienePermiso(staff.role, "servicios:leer")) {
    return (
      <main className="min-h-dvh bg-muted/30">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
          <Link
            href={`/${clinicSlug}/admin`}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Volver al panel
          </Link>
          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card p-8 text-center">
            <ShieldAlert className="size-8 text-amber-600" />
            <p className="text-lg font-semibold">Acceso restringido</p>
            <p className="text-sm text-muted-foreground">
              Tu rol ({staff.role}) no tiene acceso al catálogo de servicios.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const [servicios, tasa] = await Promise.all([
    listarServicios(supabase, staff.tenantId),
    getTasaVigente(supabase),
  ])

  return (
    <main className="min-h-dvh bg-muted/30">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <Link
          href={`/${clinicSlug}/admin`}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Volver al panel
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Servicios y honorarios médicos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catálogo de {tenant.nombre} con precios en USD, tratamiento de IVA y
          comisión del especialista. Tasa vigente: {tasa.rate} Bs/USD.
        </p>

        <div className="mt-2">
          <EnlaceGuia slug="configuracion-fiscal-tasa-servicios">
            Ver guía: alta de servicios, IVA y honorarios médicos
          </EnlaceGuia>
        </div>

        {!servicios.ok && (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300"
          >
            {servicios.message}
          </p>
        )}

        <div className="mt-6">
          <ServiciosManager
            clinicSlug={clinicSlug}
            serviciosIniciales={servicios.ok ? servicios.data : []}
            tasaBCV={tasa.rate}
            puedeEditar={tienePermiso(staff.role, "servicios:escribir")}
          />
        </div>
      </div>
    </main>
  )
}
