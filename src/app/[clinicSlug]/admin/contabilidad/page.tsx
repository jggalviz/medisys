import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"

import { ShieldAlert } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { getStaffForSlug } from "@/lib/staff"
import { getTenantBySlug } from "@/app/actions/tenant"
import { getEspecialistas } from "@/app/actions/doctors"
import { listarSedes } from "@/lib/admin/sedes"
import { listarFacturas } from "@/lib/admin/facturas"
import {
  arqueoDelDia,
  listarCierres,
  listarLiquidaciones,
} from "@/lib/admin/contabilidad"
import { generarLibroVentas } from "@/lib/admin/libro-ventas"
import {
  componerResumenContabilidad,
  mesActualVenezuela,
  rangoDelMes,
  resumirLibroVentas,
} from "@/lib/accounting-ve"
import { tienePermiso } from "@/lib/rbac"
import { fechaHoyVenezuela } from "@/lib/date"
import type { LibroVentasReporte, MedicoOpcion } from "@/types/accounting"
import { ContabilidadManager } from "@/components/admin/contabilidad/ContabilidadManager"

/**
 * Contabilidad, libros fiscales y cuadre de caja (Módulo 3).
 *
 * El servidor entrega todo lo necesario (libro del mes, arqueo del día,
 * cierres recientes y liquidaciones) y el componente cliente opera luego
 * contra `/api/admin/reports|closings|settlements`.
 */
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Contabilidad y caja | Medisys",
  robots: { index: false },
}

type Props = {
  params: Promise<{ clinicSlug: string }>
}

export default async function ContabilidadPage({ params }: Props) {
  const { clinicSlug } = await params
  const tenant = await getTenantBySlug(clinicSlug)

  if (!tenant) notFound()

  const supabase = await createClient()
  const staff = await getStaffForSlug(supabase, clinicSlug)

  if (!staff) redirect(`/${clinicSlug}/login`)

  if (!tienePermiso(staff.role, "contabilidad:leer")) {
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
              Tu rol ({staff.role}) no tiene acceso al bloque contable.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const puedeHonorarios = tienePermiso(staff.role, "honorarios:leer")
  const mes = mesActualVenezuela()
  const rango = rangoDelMes(mes.anio, mes.mes)
  const hoy = fechaHoyVenezuela()

  const [reporte, cierres, arqueo, liquidaciones, facturas, sedes, especialistas] =
    await Promise.all([
      generarLibroVentas(supabase, staff.tenantId, {
        anio: mes.anio,
        mes: mes.mes,
      }),
      listarCierres(supabase, staff.tenantId, { limite: 60 }),
      arqueoDelDia(supabase, staff.tenantId, { closingDate: hoy }),
      puedeHonorarios
        ? listarLiquidaciones(supabase, staff.tenantId, { limite: 100 })
        : Promise.resolve({ ok: true as const, data: [] }),
      listarFacturas(supabase, staff.tenantId, {
        desde: rango.desde,
        limite: 200,
      }),
      listarSedes(supabase, staff.tenantId),
      puedeHonorarios
        ? getEspecialistas(staff.tenantId)
        : Promise.resolve({ ok: true as const, data: [] }),
    ])

  const medicos: MedicoOpcion[] = especialistas.ok
    ? especialistas.data.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        especialidad: item.especialidad,
      }))
    : []

  const resumen = componerResumenContabilidad({
    facturas: facturas.ok ? facturas.data : [],
    cierres: cierres.ok ? cierres.data : [],
    liquidaciones: liquidaciones.ok ? liquidaciones.data : [],
  })

  /** Reporte vacío con la forma correcta si la generación falló. */
  const reporteFallback: LibroVentasReporte = {
    anio: mes.anio,
    mes: mes.mes,
    desde: rango.desde,
    hasta: rango.hasta,
    generadoEn: new Date().toISOString(),
    tasaReferencia: 0,
    filas: [],
    resumen: resumirLibroVentas([], 0),
  }

  return (
    <main className="min-h-dvh bg-muted/30">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href={`/${clinicSlug}/admin`}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Volver al panel
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Contabilidad y caja
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Libro de Ventas del SENIAT, arqueo diario de caja y liquidación de
          honorarios de {tenant.nombre}.
        </p>

        {!reporte.ok && (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300"
          >
            {reporte.message}
          </p>
        )}

        <div className="mt-6">
          <ContabilidadManager
            clinicSlug={clinicSlug}
            sedes={sedes.ok ? sedes.data : []}
            medicos={medicos}
            reporteInicial={reporte.ok ? reporte.data : reporteFallback}
            cierresIniciales={cierres.ok ? cierres.data : []}
            arqueoInicial={arqueo.ok ? arqueo.data : null}
            liquidacionesIniciales={liquidaciones.ok ? liquidaciones.data : []}
            resumen={resumen}
            permisos={{
              cerrar: tienePermiso(staff.role, "contabilidad:escribir"),
              auditar: tienePermiso(staff.role, "honorarios:escribir"),
              honorarios: puedeHonorarios,
            }}
            sedeIdsAsignadas={staff.sedeIds}
          />
        </div>
      </div>
    </main>
  )
}
