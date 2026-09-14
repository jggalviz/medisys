import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"

import { ShieldAlert } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { getStaffForSlug } from "@/lib/staff"
import { getTenantBySlug } from "@/app/actions/tenant"
import { leerEntidadFiscal } from "@/lib/admin/fiscal"
import { listarSedes } from "@/lib/admin/sedes"
import { getTasaVigente, historialTasas } from "@/lib/currency-rates"
import { tienePermiso } from "@/lib/rbac"
import { TenantSettings } from "@/components/admin/configuracion/TenantSettings"
import { EntidadFiscalCard } from "@/components/admin/configuracion/EntidadFiscalCard"
import { TasaBcvCard } from "@/components/admin/configuracion/TasaBcvCard"
import { SedesManager } from "@/components/admin/configuracion/SedesManager"
import { EnlaceGuia } from "@/components/admin/guia/EnlaceGuia"

/**
 * Evita el renderizado estático/cacheo: esta página lee la sesión del admin
 * y los datos actuales de la clínica en cada petición para reflejar cambios.
 */
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Configuración de la Clínica | Medisys",
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

  // Administrador (todo) y contador (módulo fiscal/financiero) acceden aquí.
  const esAdmin = staff.role === "admin"
  const puedeVerFiscal = tienePermiso(staff.role, "fiscal:leer")

  if (!esAdmin && !puedeVerFiscal) {
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
              La configuración de la clínica está disponible para los roles{" "}
              <strong>Administrador</strong> y <strong>Contador</strong>. Tu
              usuario tiene el rol {staff.role}.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const [fiscal, sedes, tasa, historial] = await Promise.all([
    leerEntidadFiscal(supabase, staff.tenantId),
    listarSedes(supabase, staff.tenantId),
    getTasaVigente(supabase),
    historialTasas(supabase, { limite: 5 }),
  ])

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
          Configuración de la Clínica
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administra la información fiscal, la multimoneda y la operación de{" "}
          {tenant.nombre}.
        </p>

        <div className="mt-2">
          <EnlaceGuia slug="configuracion-fiscal-tasa-servicios">
            Ver guía: entidad fiscal, tasa BCV y sedes
          </EnlaceGuia>
        </div>

        {fiscal.ok ? (
          <EntidadFiscalCard
            clinicSlug={clinicSlug}
            fiscal={fiscal.data}
            puedeEditar={tienePermiso(staff.role, "fiscal:escribir")}
          />
        ) : (
          <p
            role="alert"
            className="mt-6 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300"
          >
            {fiscal.message}
          </p>
        )}

        <TasaBcvCard
          clinicSlug={clinicSlug}
          tasaInicial={tasa}
          historialInicial={historial}
          puedeEditar={tienePermiso(staff.role, "tasa:escribir")}
        />

        <SedesManager
          clinicSlug={clinicSlug}
          sedesIniciales={sedes.ok ? sedes.data : []}
          aviso={sedes.ok ? null : sedes.message}
          puedeEditar={tienePermiso(staff.role, "sedes:escribir")}
          sedeIdsAsignadas={staff.sedeIds}
        />

        {/* Ajustes operativos (pago móvil, branding, apariencia): solo admin. */}
        {esAdmin && <TenantSettings tenant={tenant} />}
      </div>
    </main>
  )
}

