"use client"

/**
 * MEDISYS · Contabilidad, Libros Fiscales y Cuadre de Caja (Módulo 3)
 * -------------------------------------------------------------------
 * Contenedor con tres vistas:
 *   1. «Libro de Ventas SENIAT»  → reporte mensual + exportación CSV.
 *   2. «Cierre y arqueo de caja» → cuadre diario por sede.
 *   3. «Honorarios médicos»      → liquidación de especialistas.
 */
import { useState } from "react"
import { BookText, Landmark, Stethoscope } from "lucide-react"

import type { SedeDTO } from "@/types/admin"
import type {
  ArqueoCalculado,
  CierreCajaDTO,
  LibroVentasReporte,
  LiquidacionDTO,
  MedicoOpcion,
  ResumenContabilidad,
} from "@/types/accounting"
import { LibroVentasSENIAT } from "@/components/admin/contabilidad/LibroVentasSENIAT"
import { CierreCaja } from "@/components/admin/contabilidad/CierreCaja"
import { HonorariosMedicos } from "@/components/admin/contabilidad/HonorariosMedicos"
import { formatBs, formatUSD } from "@/lib/format"
import { cn } from "@/lib/utils"

type Tab = "libro" | "caja" | "honorarios"

export function ContabilidadManager({
  clinicSlug,
  sedes,
  medicos,
  reporteInicial,
  cierresIniciales,
  arqueoInicial,
  liquidacionesIniciales,
  resumen,
  permisos,
  sedeIdsAsignadas,
}: {
  clinicSlug: string
  sedes: SedeDTO[]
  medicos: MedicoOpcion[]
  reporteInicial: LibroVentasReporte
  cierresIniciales: CierreCajaDTO[]
  arqueoInicial: ArqueoCalculado | null
  liquidacionesIniciales: LiquidacionDTO[]
  resumen: ResumenContabilidad
  permisos: { cerrar: boolean; auditar: boolean; honorarios: boolean }
  sedeIdsAsignadas: string[]
}) {
  const [tab, setTab] = useState<Tab>("libro")

  const pestanas: { id: Tab; label: string; icono: React.ReactNode }[] = [
    {
      id: "libro",
      label: "Libro de Ventas SENIAT",
      icono: <BookText className="size-4" aria-hidden="true" />,
    },
    {
      id: "caja",
      label: "Cierre y arqueo de caja",
      icono: <Landmark className="size-4" aria-hidden="true" />,
    },
    ...(permisos.honorarios
      ? [
          {
            id: "honorarios" as Tab,
            label: "Honorarios médicos",
            icono: <Stethoscope className="size-4" aria-hidden="true" />,
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs del mes */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          titulo="Facturado (mes)"
          principal={formatUSD(resumen.ventasUSD)}
          detalle={formatBs(resumen.ventasVES)}
        />
        <Kpi
          titulo="Cobrado / por cobrar"
          principal={formatUSD(resumen.cobradoUSD)}
          detalle={`Por cobrar ${formatUSD(resumen.porCobrarUSD)}`}
        />
        <Kpi
          titulo="IVA + IGTF"
          principal={formatUSD(resumen.ivaUSD + resumen.igtfUSD)}
          detalle={`IGTF ${formatUSD(resumen.igtfUSD)}`}
        />
        <Kpi
          titulo="Caja y honorarios"
          principal={formatUSD(resumen.diferenciaCajaUSD)}
          detalle={`${resumen.cierresAbiertos} cajas abiertas · honorarios por pagar ${formatUSD(
            resumen.liquidacionesPendientesUSD
          )}`}
        />
      </section>

      {/* Pestañas */}
      <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-1">
        {pestanas.map((pestana) => (
          <button
            key={pestana.id}
            type="button"
            onClick={() => setTab(pestana.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === pestana.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {pestana.icono}
            <span className="truncate">{pestana.label}</span>
          </button>
        ))}
      </div>

      {tab === "libro" && (
        <LibroVentasSENIAT
          clinicSlug={clinicSlug}
          reporteInicial={reporteInicial}
          sedes={sedes}
        />
      )}

      {tab === "caja" && (
        <CierreCaja
          clinicSlug={clinicSlug}
          sedes={sedes}
          arqueoInicial={arqueoInicial}
          cierresIniciales={cierresIniciales}
          puedeCerrar={permisos.cerrar}
          puedeAuditar={permisos.auditar}
          sedeIdsAsignadas={sedeIdsAsignadas}
        />
      )}

      {tab === "honorarios" && permisos.honorarios && (
        <HonorariosMedicos
          clinicSlug={clinicSlug}
          medicos={medicos}
          liquidacionesIniciales={liquidacionesIniciales}
          puedeEditar={permisos.honorarios}
        />
      )}
    </div>
  )
}

function Kpi({
  titulo,
  principal,
  detalle,
}: {
  titulo: string
  principal: string
  detalle: string
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border bg-card p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {titulo}
      </span>
      <span className="text-xl font-bold tabular-nums">{principal}</span>
      <span className="text-xs text-muted-foreground">{detalle}</span>
    </div>
  )
}
