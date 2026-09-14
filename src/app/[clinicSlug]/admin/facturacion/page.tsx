import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"

import { ShieldAlert } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { getStaffForSlug } from "@/lib/staff"
import { getTenantBySlug } from "@/app/actions/tenant"
import { listarPacientesFacturables } from "@/lib/admin/pacientes"
import { listarServicios } from "@/lib/admin/servicios"
import { listarSedes } from "@/lib/admin/sedes"
import { listarFacturas } from "@/lib/admin/facturas"
import { getTasaVigente } from "@/lib/currency-rates"
import { tienePermiso } from "@/lib/rbac"
import { FacturacionManager } from "@/components/admin/facturacion/FacturacionManager"
import { EnlaceGuia } from "@/components/admin/guia/EnlaceGuia"

/**
 * Facturación y cobros (Módulo 2).
 *
 * Carga en el servidor (RLS + sesión del staff) el catálogo, el directorio de
 * pacientes, las sedes, la tasa BCV vigente y las facturas del mes en curso;
 * el componente cliente opera luego contra `/api/admin/invoices`.
 */
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Facturación y cobros | Medisys",
  robots: { index: false },
}

type Props = {
  params: Promise<{ clinicSlug: string }>
}

/** Primer día del mes en curso (hora de Venezuela) en 'YYYY-MM-DD'. */
function inicioDeMes(): string {
  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
  return `${hoy.slice(0, 7)}-01`
}

export default async function FacturacionPage({ params }: Props) {
  const { clinicSlug } = await params
  const tenant = await getTenantBySlug(clinicSlug)

  if (!tenant) notFound()

  const supabase = await createClient()
  const staff = await getStaffForSlug(supabase, clinicSlug)

  if (!staff) redirect(`/${clinicSlug}/login`)

  if (!tienePermiso(staff.role, "facturacion:leer")) {
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
              Tu rol ({staff.role}) no tiene acceso al módulo de facturación.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const [pacientes, servicios, sedes, facturas, tasa] = await Promise.all([
    listarPacientesFacturables(supabase, staff.tenantId, { limite: 200 }),
    listarServicios(supabase, staff.tenantId),
    listarSedes(supabase, staff.tenantId),
    listarFacturas(supabase, staff.tenantId, {
      desde: inicioDeMes(),
      limite: 200,
    }),
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
          Facturación y cobros
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Emite facturas fiscales de {tenant.nombre} con número de control,
          desglose de IVA, IGTF del 3% en divisas y doble despliegue USD/VES a la
          tasa BCV vigente ({tasa.rate} Bs/USD · {tasa.detalle}).
        </p>

        <div className="mt-2">
          <EnlaceGuia slug="facturacion-e-igtf">
            ¿Cómo emitir facturas y aplicar el IGTF? Ver guía
          </EnlaceGuia>
        </div>

        {!facturas.ok && (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300"
          >
            {facturas.message}
          </p>
        )}

        <div className="mt-6">
          <FacturacionManager
            clinicSlug={clinicSlug}
            facturasIniciales={facturas.ok ? facturas.data : []}
            pacientes={pacientes.ok ? pacientes.data : []}
            servicios={servicios.ok ? servicios.data : []}
            sedes={sedes.ok ? sedes.data : []}
            tasaBCV={tasa.rate}
            permisos={{
              emitir: tienePermiso(staff.role, "facturacion:emitir"),
              cobrar: tienePermiso(staff.role, "cobros:registrar"),
              anular: tienePermiso(staff.role, "facturacion:anular"),
            }}
            sedeIdsAsignadas={staff.sedeIds}
          />
        </div>
      </div>
    </main>
  )
}
