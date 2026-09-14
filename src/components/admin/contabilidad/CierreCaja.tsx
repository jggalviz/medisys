"use client"

/**
 * MEDISYS · Cierre y arqueo de caja (Módulo 3)
 * --------------------------------------------
 * La recepción o el administrador cuadran los cobros del día:
 *   1. Se elige fecha y sede y el sistema calcula lo esperado por método.
 *   2. Se carga el conteo físico (USD y Bs) de cada método.
 *   3. Se ven los descalces (faltante/sobrante) y se guarda avance o se cierra.
 * Debajo queda el histórico de arqueos con su estado y auditoría.
 */
import { useMemo, useState } from "react"
import {
  CheckCircle2,
  ClipboardCheck,
  LoaderCircle,
  RefreshCw,
  Scale,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react"

import type { SedeDTO } from "@/types/admin"
import type {
  ArqueoCalculado,
  ArqueoMetodoFila,
  CierreCajaDTO,
} from "@/types/accounting"
import {
  ETIQUETA_ESTADO_ARQUEO,
  ETIQUETA_ESTADO_CIERRE,
  TONO_ESTADO_ARQUEO,
  TONO_ESTADO_CIERRE,
  aplicarConteo,
  etiquetaMetodoCobro,
} from "@/lib/accounting-ve"
import {
  apiActualizarCierre,
  apiGuardarCierre,
  apiListarCierres,
} from "@/lib/api-contabilidad"
import type { TonoEstado } from "@/lib/billing-ve"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fechaHoyVenezuela } from "@/lib/date"
import { formatBs, formatUSD } from "@/lib/format"
import { cn } from "@/lib/utils"

const CLASE_TONO: Record<TonoEstado, string> = {
  muted: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  sky: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  red: "bg-red-500/15 text-red-700 dark:text-red-400",
}

type Toast = { tipo: "ok" | "error"; mensaje: string } | null

/** Conteo capturado en pantalla por método. */
type ConteoForm = Record<string, { usd: string; ves: string }>

export function CierreCaja({
  clinicSlug,
  sedes,
  arqueoInicial,
  cierresIniciales,
  puedeCerrar,
  puedeAuditar,
  sedeIdsAsignadas,
}: {
  clinicSlug: string
  sedes: SedeDTO[]
  arqueoInicial: ArqueoCalculado | null
  cierresIniciales: CierreCajaDTO[]
  puedeCerrar: boolean
  puedeAuditar: boolean
  sedeIdsAsignadas: string[]
}) {
  const sedeInicial = useMemo(() => {
    const asignadas = sedes.filter((sede) =>
      sedeIdsAsignadas.includes(sede.id)
    )
    const principal = asignadas.find((sede) => sede.esPrincipal)
    return principal?.id ?? asignadas[0]?.id ?? sedes[0]?.id ?? ""
  }, [sedes, sedeIdsAsignadas])

  const [fecha, setFecha] = useState(fechaHoyVenezuela())
  const [sedeId, setSedeId] = useState(sedeInicial)
  const [arqueo, setArqueo] = useState<ArqueoCalculado | null>(arqueoInicial)
  const [conteo, setConteo] = useState<ConteoForm>({})
  const [notas, setNotas] = useState("")
  const [cierres, setCierres] = useState<CierreCajaDTO[]>(cierresIniciales)
  const [cargando, setCargando] = useState(false)
  const [ocupado, setOcupado] = useState<"avance" | "cerrar" | string | null>(
    null
  )
  const [toast, setToast] = useState<Toast>(null)

  /** Desglose esperado del sistema (memorizado para no recrear el array). */
  const breakdown: ArqueoMetodoFila[] = useMemo(
    () => arqueo?.breakdown ?? [],
    [arqueo]
  )

  /** Resultado del arqueo con el conteo capturado (cálculo puro local). */
  const resultado = useMemo(
    () =>
      aplicarConteo(
        breakdown,
        breakdown.map((fila) => {
          const entrada = conteo[fila.method]
          return {
            method: fila.method,
            countedUSD: Number((entrada?.usd ?? "").replace(",", ".")) || 0,
            countedVES: Number((entrada?.ves ?? "").replace(",", ".")) || 0,
          }
        })
      ),
    [breakdown, conteo]
  )

  /** Recalcula lo esperado por el sistema para la fecha/sede elegidas. */
  async function recalcular() {
    setCargando(true)
    setToast(null)
    const respuesta = await apiListarCierres(clinicSlug, {
      fecha,
      sedeId: sedeId || null,
      limite: 60,
    })
    setCargando(false)

    if (!respuesta.ok) {
      setToast({ tipo: "error", mensaje: respuesta.message })
      return
    }
    setArqueo(respuesta.data.arqueo)
    setCierres(respuesta.data.cierres)
    if (respuesta.data.arqueoAviso) {
      setToast({ tipo: "error", mensaje: respuesta.data.arqueoAviso })
    }
  }

  function cargarConteoDesdeExistente() {
    const cierreDelDia = cierres.find(
      (cierre) =>
        cierre.closingDate === fecha &&
        (sedeId ? cierre.sedeId === sedeId : cierre.sedeId === null)
    )
    if (!cierreDelDia) {
      setToast({
        tipo: "error",
        mensaje: "No hay un arqueo guardado para esa fecha y sede.",
      })
      return
    }

    const nuevo: ConteoForm = {}
    for (const fila of cierreDelDia.breakdown) {
      nuevo[fila.method] = {
        usd: String(fila.countedUSD),
        ves: String(fila.countedVES),
      }
    }
    setConteo(nuevo)
    setNotas(cierreDelDia.notes ?? "")
    setToast({
      tipo: "ok",
      mensaje: `Conteo del arqueo ${cierreDelDia.closingDate} cargado.`,
    })
  }

  async function guardar(finalizar: boolean) {
    if (!puedeCerrar) return
    setOcupado(finalizar ? "cerrar" : "avance")
    setToast(null)

    const respuesta = await apiGuardarCierre(clinicSlug, {
      closingId: null,
      sedeId: sedeId || null,
      closingDate: fecha,
      finalizar,
      conteo: breakdown.map((fila) => {
        const entrada = conteo[fila.method]
        return {
          method: fila.method,
          countedUSD: Number((entrada?.usd ?? "").replace(",", ".")) || 0,
          countedVES: Number((entrada?.ves ?? "").replace(",", ".")) || 0,
        }
      }),
      notes: notas || null,
    })
    setOcupado(null)

    if (!respuesta.ok) {
      setToast({ tipo: "error", mensaje: respuesta.message })
      return
    }

    setArqueo(respuesta.data.arqueo)
    setCierres((previo) => {
      const otros = previo.filter((item) => item.id !== respuesta.data.cierre.id)
      return [respuesta.data.cierre, ...otros]
    })
    setToast({
      tipo: "ok",
      mensaje: finalizar
        ? `Caja cerrada. Descalce: ${formatUSD(respuesta.data.cierre.differenceUSD)} (${formatBs(respuesta.data.cierre.differenceVES)}).`
        : "Avance del arqueo guardado.",
    })
  }

  async function auditar(cierre: CierreCajaDTO) {
    setOcupado(cierre.id)
    const respuesta = await apiActualizarCierre(clinicSlug, cierre.id, {
      accion: "auditar",
      notes: null,
    })
    setOcupado(null)

    if (!respuesta.ok) {
      setToast({ tipo: "error", mensaje: respuesta.message })
      return
    }
    setCierres((previo) =>
      previo.map((item) => (item.id === respuesta.data.id ? respuesta.data : item))
    )
    setToast({ tipo: "ok", mensaje: "Arqueo auditado y bloqueado." })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filtros de la jornada */}
      <section className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium">Fecha del cuadre</Label>
          <Input
            type="date"
            value={fecha}
            onChange={(evento) => setFecha(evento.target.value || fecha)}
            className="h-10 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium">Sede / caja</Label>
          <select
            value={sedeId}
            onChange={(evento) => setSedeId(evento.target.value)}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Caja única de la clínica</option>
            {sedes.map((sede) => (
              <option key={sede.id} value={sede.id}>
                {sede.nombre}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          onClick={() => void recalcular()}
          disabled={cargando}
          className="h-10 gap-2 rounded-xl px-4"
        >
          {cargando ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" aria-hidden="true" />
          )}
          Calcular sistema
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={cargarConteoDesdeExistente}
          className="h-10 gap-2 rounded-xl px-4"
        >
          <ClipboardCheck className="size-4" aria-hidden="true" />
          Cargar conteo guardado
        </Button>
      </section>

      {toast && (
        <p
          role="status"
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
            toast.tipo === "ok"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-destructive/10 text-destructive"
          )}
        >
          {toast.tipo === "ok" ? (
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          ) : (
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
          )}
          {toast.mensaje}
        </p>
      )}

      {/* Totales del arqueo */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato
          titulo="Esperado por el sistema"
          principal={formatUSD(resultado.esperadoUSD)}
          secundario={formatBs(resultado.esperadoVES)}
        />
        <Dato
          titulo="Contado en caja"
          principal={formatUSD(resultado.contadoUSD)}
          secundario={formatBs(resultado.contadoVES)}
        />
        <Dato
          titulo="Descalce USD"
          principal={formatUSD(resultado.differenceUSD)}
          secundario={`${resultado.breakdown.reduce((t, f) => t + f.operaciones, 0)} operaciones del sistema`}
          destacado={Math.abs(resultado.differenceUSD) > 0.01}
        />
        <div className="flex flex-col gap-1 rounded-2xl border bg-card p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Estado del arqueo
          </span>
          <span
            className={cn(
              "w-fit rounded-full px-2.5 py-1 text-xs font-semibold",
              CLASE_TONO[TONO_ESTADO_ARQUEO[resultado.estado]]
            )}
          >
            {ETIQUETA_ESTADO_ARQUEO[resultado.estado]}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            Descalce Bs: {formatBs(resultado.differenceVES)}
          </span>
        </div>
      </section>

      {/* Detalle por método */}
      <section className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="bg-muted/60 text-left text-xs">
            <tr>
              <th className="px-3 py-2 font-semibold">Método de cobro</th>
              <th className="px-3 py-2 text-right font-semibold">
                Esperado USD
              </th>
              <th className="px-3 py-2 text-right font-semibold">Contado USD</th>
              <th className="px-3 py-2 text-right font-semibold">
                Esperado Bs.
              </th>
              <th className="px-3 py-2 text-right font-semibold">Contado Bs.</th>
              <th className="px-3 py-2 text-right font-semibold">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {resultado.breakdown.map((fila) => (
              <tr key={fila.method} className="border-t">
                <td className="px-3 py-2">
                  <span className="flex flex-col">
                    <span className="font-medium">
                      {etiquetaMetodoCobro(fila.method)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {fila.operaciones} operación(es) del sistema
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatUSD(fila.expectedUSD)}
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={conteo[fila.method]?.usd ?? ""}
                    onChange={(evento) =>
                      setConteo((previo) => ({
                        ...previo,
                        [fila.method]: {
                          usd: evento.target.value,
                          ves: previo[fila.method]?.ves ?? "",
                        },
                      }))
                    }
                    disabled={!puedeCerrar}
                    inputMode="decimal"
                    placeholder="0,00"
                    aria-label={`Contado USD ${etiquetaMetodoCobro(fila.method)}`}
                    className="h-9 w-28 text-right text-sm"
                  />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatBs(fila.expectedVES)}
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={conteo[fila.method]?.ves ?? ""}
                    onChange={(evento) =>
                      setConteo((previo) => ({
                        ...previo,
                        [fila.method]: {
                          usd: previo[fila.method]?.usd ?? "",
                          ves: evento.target.value,
                        },
                      }))
                    }
                    disabled={!puedeCerrar}
                    inputMode="decimal"
                    placeholder="0,00"
                    aria-label={`Contado Bs. ${etiquetaMetodoCobro(fila.method)}`}
                    className="h-9 w-32 text-right text-sm"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                      Math.abs(fila.differenceUSD) <= 0.01
                        ? CLASE_TONO.emerald
                        : fila.differenceUSD > 0
                          ? CLASE_TONO.amber
                          : CLASE_TONO.red
                    )}
                  >
                    {formatUSD(fila.differenceUSD)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Guardar / cerrar */}
      {puedeCerrar && (
        <section className="flex flex-wrap items-end gap-3 border-t pt-4">
          <div className="flex min-w-64 flex-1 flex-col gap-1.5">
            <Label className="text-xs font-medium">
              Nota del arqueo (diferencias, observaciones)
            </Label>
            <Input
              value={notas}
              onChange={(evento) => setNotas(evento.target.value)}
              placeholder="Ej.: faltante en efectivo Bs. reportado por la cajera"
              className="h-10 text-sm"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void guardar(false)}
            disabled={ocupado !== null}
            className="h-10 gap-2 rounded-xl px-4"
          >
            {ocupado === "avance" && (
              <LoaderCircle className="size-4 animate-spin" />
            )}
            Guardar avance
          </Button>
          <Button
            type="button"
            onClick={() => void guardar(true)}
            disabled={ocupado !== null}
            className="h-10 gap-2 rounded-xl px-4"
          >
            {ocupado === "cerrar" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Scale className="size-4" aria-hidden="true" />
            )}
            Cerrar caja del día
          </Button>
        </section>
      )}

      {/* Histórico */}
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Histórico de arqueos ({cierres.length})
        </h3>
        {cierres.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Aún no hay arqueos registrados. Cierra la caja del día para generar
            el primero.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {cierres.map((cierre) => (
              <li
                key={cierre.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3 text-sm"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold tabular-nums">
                      {cierre.closingDate}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        CLASE_TONO[TONO_ESTADO_CIERRE[cierre.status]]
                      )}
                    >
                      {ETIQUETA_ESTADO_CIERRE[cierre.status]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {cierre.sedeNombre ?? "Caja única"}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Esperado {formatUSD(cierre.totalExpectedUSD)} · Contado{" "}
                    {formatUSD(cierre.totalActualUSD)} · Descalce{" "}
                    {formatUSD(cierre.differenceUSD)} ({formatBs(cierre.differenceVES)})
                  </span>
                  {cierre.notes && (
                    <span className="text-xs text-muted-foreground">
                      {cierre.notes}
                    </span>
                  )}
                </div>

                {puedeAuditar && cierre.status === "CLOSED" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void auditar(cierre)}
                    disabled={ocupado === cierre.id}
                    className="h-9 shrink-0 gap-2 rounded-xl px-3 text-sm"
                  >
                    {ocupado === cierre.id ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="size-4" aria-hidden="true" />
                    )}
                    Auditar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Dato({
  titulo,
  principal,
  secundario,
  destacado,
}: {
  titulo: string
  principal: string
  secundario: string
  destacado?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-2xl border bg-card p-4",
        destacado && "border-amber-400/60 bg-amber-500/5"
      )}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {titulo}
      </span>
      <span className="text-lg font-bold tabular-nums">{principal}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {secundario}
      </span>
    </div>
  )
}
