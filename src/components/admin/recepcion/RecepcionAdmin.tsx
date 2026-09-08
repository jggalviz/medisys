"use client"

/**
 * Vista de recepción: cola de citas del día.
 *
 * - Carga citas del día vía `getDailyAppointments`.
 * - Filtros por turno y especialista.
 * - Acciones según estado: cobro en caja, marcar llegada,
 *   llamar a consulta y finalizar cita.
 */
import { useEffect, useMemo, useState } from "react"
import { LoaderCircle, RefreshCw, ShieldAlert, X } from "lucide-react"

import type {
  DailyAppointmentItem,
  MetodoCobroRecepcion,
} from "@/types/admin"
import type { TurnoSeleccionado } from "@/types/booking"
import type { AppointmentStatus } from "@/types/database"
import { getDailyAppointments, updateAppointmentStatus } from "@/app/actions/admin"
import { toISODate } from "@/lib/date"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/* Meta de estados                                                     */
/* ------------------------------------------------------------------ */

type EstadoMeta = { label: string; dot: string; badge: string }

const ESTADO_META: Partial<Record<AppointmentStatus, EstadoMeta>> = {
  pago_en_recepcion: {
    label: "Pago en caja",
    dot: "bg-amber-500",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  confirmada: {
    label: "Confirmada",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  en_espera: {
    label: "En espera",
    dot: "bg-sky-500",
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  },
  en_consulta: {
    label: "En consulta",
    dot: "bg-indigo-500",
    badge: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
  },
  atendido: {
    label: "Atendido",
    dot: "bg-zinc-400",
    badge: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
  },
}

const ORDEN_SECCIONES: AppointmentStatus[] = [
  "pago_en_recepcion",
  "confirmada",
  "en_espera",
  "en_consulta",
  "atendido",
]

function metaEstado(estado: AppointmentStatus): EstadoMeta {
  return (
    ESTADO_META[estado] ?? {
      label: estado,
      dot: "bg-zinc-400",
      badge: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
    }
  )
}

const ETIQUETA_TURNO: Record<TurnoSeleccionado, string> = {
  manana: "Mañana",
  tarde: "Tarde",
}

const METODOS: { id: MetodoCobroRecepcion; label: string }[] = [
  { id: "efectivo", label: "Efectivo 💵" },
  { id: "punto", label: "Punto de Venta 🏧" },
  { id: "pago_movil", label: "Pago Móvil 📱" },
]

function nombrePaciente(item: DailyAppointmentItem): string {
  const p = item.paciente
  if (!p) return "Paciente invitado"
  return [p.nombres, p.apellidos].filter(Boolean).join(" ").trim() || "Sin nombre"
}

function nombreEspecialista(item: DailyAppointmentItem): string {
  const d = item.especialista
  if (!d) return "Especialista no encontrado"
  return [d.nombres, d.apellidos].filter(Boolean).join(" ").trim() || d.especialidad
}

function horaCita(item: DailyAppointmentItem): string {
  return item.fecha_hora.length >= 16 ? item.fecha_hora.slice(11, 16) : ""
}

/* ------------------------------------------------------------------ */
/* Skeletons de carga                                                  */
/* ------------------------------------------------------------------ */

function ColaSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      {[0, 1, 2].map((n) => (
        <div
          key={n}
          className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-2/5 animate-pulse rounded-full bg-muted" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="h-3 w-3/5 animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-2/5 animate-pulse rounded-full bg-muted" />
          <div className="h-10 w-44 animate-pulse rounded-xl bg-muted" />
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Modal de cobro en caja                                              */
/* ------------------------------------------------------------------ */

function CobroModal({
  item,
  onCancel,
  onConfirm,
  busy,
}: {
  item: DailyAppointmentItem
  onCancel: () => void
  onConfirm: (metodo: MetodoCobroRecepcion) => void
  busy: boolean
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Cobro en caja de ${nombrePaciente(item)}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border bg-background shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <span className="text-sm font-semibold">Cobro en caja</span>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Cerrar"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4">
          <p className="text-sm text-muted-foreground">
            Cobrar la consulta de{" "}
            <strong className="text-foreground">{nombrePaciente(item)}</strong>{" "}
            y moverlo a la sala de espera.
          </p>
          <div className="flex flex-col gap-2">
            {METODOS.map((metodo) => (
              <Button
                key={metodo.id}
                variant="outline"
                disabled={busy}
                onClick={() => onConfirm(metodo.id)}
                className="h-12 justify-start rounded-xl text-base"
              >
                {metodo.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

type FiltroTurno = "todos" | TurnoSeleccionado
type Feedback = { tipo: "ok" | "error"; mensaje: string } | null

export function RecepcionAdmin({
  tenantId,
  initialDate,
}: {
  tenantId: string
  initialDate?: string
}) {
  const [date, setDate] = useState<string>(initialDate || toISODate(new Date()))
  const [items, setItems] = useState<DailyAppointmentItem[]>([])
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading")
  const [error, setError] = useState<string | null>(null)
  const [filtroTurno, setFiltroTurno] = useState<FiltroTurno>("todos")
  const [filtroEspecialista, setFiltroEspecialista] = useState<string>("todos")
  const [cobroItem, setCobroItem] = useState<DailyAppointmentItem | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)

  // Carga inicial / cambio de fecha (el reset de estados lo hace el handler).
  useEffect(() => {
    let active = true

    void getDailyAppointments({ tenantId, date }).then((result) => {
      if (!active) return
      if (result.ok) {
        setItems(result.data)
        setStatus("ok")
      } else {
        setStatus("error")
        setError(result.message)
      }
    })
    return () => {
      active = false
    }
  }, [tenantId, date])

  const especialistas = useMemo(() => {
    const unicos = new Map<string, { id: string; nombre: string }>()
    for (const item of items) {
      const esp = item.especialista
      if (!esp || unicos.has(esp.id)) continue
      unicos.set(esp.id, {
        id: esp.id,
        nombre: `${nombreEspecialista(item)} · ${esp.especialidad}`,
      })
    }
    return Array.from(unicos.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es")
    )
  }, [items])

  const filtrados = useMemo(() => {
    return items.filter((item) => {
      const turnoOk =
        filtroTurno === "todos" ||
        (item.turno ?? null) === filtroTurno
      const espOk =
        filtroEspecialista === "todos" ||
        item.especialista?.id === filtroEspecialista
      return turnoOk && espOk
    })
  }, [items, filtroTurno, filtroEspecialista])

  const secciones = useMemo(() => {
    const porEstado = new Map<AppointmentStatus, DailyAppointmentItem[]>()
    for (const item of filtrados) {
      const lista = porEstado.get(item.estado) ?? []
      lista.push(item)
      porEstado.set(item.estado, lista)
    }
    return ORDEN_SECCIONES.map((estado) => ({
      estado,
      citas: (porEstado.get(estado) ?? []).sort((a, b) =>
        (a.created_at ?? "").localeCompare(b.created_at ?? "")
      ),
    })).filter((s) => s.citas.length > 0)
  }, [filtrados])

  const otros = useMemo(
    () =>
      filtrados
        .filter((item) => !ORDEN_SECCIONES.includes(item.estado))
        .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "")),
    [filtrados]
  )

  async function mover(
    item: DailyAppointmentItem,
    estado: "confirmada" | "en_espera" | "en_consulta" | "atendido",
    paymentMethod?: MetodoCobroRecepcion
  ) {
    if (busyId) return
    setBusyId(item.id)
    setFeedback(null)

    const result = await updateAppointmentStatus({
      appointmentId: item.id,
      status: estado,
      paymentMethod: paymentMethod ?? null,
    })

    setBusyId(null)

    if (result.ok) {
      const etiqueta = metaEstado(result.data.estado).label
      setFeedback({
        tipo: "ok",
        mensaje: `${nombrePaciente(item)} → ${etiqueta}`,
      })
      setItems((prev) =>
        prev.map((cita) =>
          cita.id === item.id ? { ...cita, estado: result.data.estado } : cita
        )
      )
      setCobroItem(null)
      return
    }
    setFeedback({ tipo: "error", mensaje: result.message })
  }

  function recargar() {
    setStatus("loading")
    setError(null)
    void getDailyAppointments({ tenantId, date }).then((result) => {
      if (result.ok) {
        setItems(result.data)
        setStatus("ok")
      } else {
        setStatus("error")
        setError(result.message)
      }
    })
  }

    return (
    <div className="flex flex-col gap-5">
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="fecha-dia"
            className="text-xs font-medium text-muted-foreground"
          >
            Fecha
          </label>
          <input
            id="fecha-dia"
            type="date"
            value={date}
            onChange={(e) => {
              setItems([])
              setStatus("loading")
              setError(null)
              setDate(e.target.value)
            }}
            className="h-10 rounded-xl border bg-background px-3 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="filtro-turno"
            className="text-xs font-medium text-muted-foreground"
          >
            Turno
          </label>
          <select
            id="filtro-turno"
            value={filtroTurno}
            onChange={(e) => setFiltroTurno(e.target.value as FiltroTurno)}
            className="h-10 rounded-xl border bg-background px-3 text-sm"
          >
            <option value="todos">Todos</option>
            <option value="manana">Mañana</option>
            <option value="tarde">Tarde</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="filtro-especialista"
            className="text-xs font-medium text-muted-foreground"
          >
            Especialista
          </label>
          <select
            id="filtro-especialista"
            value={filtroEspecialista}
            onChange={(e) => setFiltroEspecialista(e.target.value)}
            className="h-10 max-w-56 rounded-xl border bg-background px-3 text-sm"
          >
            <option value="todos">Todos</option>
            {especialistas.map((esp) => (
              <option key={esp.id} value={esp.id}>
                {esp.nombre}
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="outline"
          onClick={() => recargar()}
          className="h-10 gap-1.5"
        >
          <RefreshCw className="size-4" />
          Actualizar
        </Button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          role="status"
          className={cn(
            "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm",
            feedback.tipo === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          {feedback.tipo === "ok" ? (
            <span aria-hidden="true">✅</span>
          ) : (
            <ShieldAlert className="size-4" />
          )}
          {feedback.mensaje}
        </div>
      )}

      {/* Estados de carga / error / vacío */}
      {status === "loading" && <ColaSkeleton />}

      {status === "error" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <ShieldAlert className="size-4" />
            No pudimos cargar las citas del día
          </p>
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => recargar()}>
            Reintentar
          </Button>
        </div>
      )}

      {status === "ok" && filtrados.length === 0 && (
        <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          No hay citas que coincidan con los filtros seleccionados.
        </p>
      )}

            {secciones.map((seccion) => {
        const meta = metaEstado(seccion.estado)
        return (
          <section
            key={seccion.estado}
            className="flex flex-col gap-3"
            aria-label={`${meta.label} (${seccion.citas.length})`}
          >
            <header className="flex items-center gap-2">
              <span className={cn("size-2.5 rounded-full", meta.dot)} />
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {meta.label}
              </h2>
              <Badge variant="secondary">{seccion.citas.length}</Badge>
            </header>
            <ul className="flex flex-col gap-3">
              {seccion.citas.map((item) => (
                <CitaCard
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  onCobrar={() => setCobroItem(item)}
                  onMarcarLlegada={() => void mover(item, "en_espera")}
                  onLlamarConsulta={() => void mover(item, "en_consulta")}
                  onFinalizar={() => void mover(item, "atendido")}
                />
              ))}
            </ul>
          </section>
        )
      })}

      {otros.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Otros estados">
          <header className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-zinc-400" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Otros
            </h2>
            <Badge variant="secondary">{otros.length}</Badge>
          </header>
          <ul className="flex flex-col gap-3">
            {otros.map((item) => (
              <CitaCard
                key={item.id}
                item={item}
                busy={busyId === item.id}
                onCobrar={() => setCobroItem(item)}
                onMarcarLlegada={() => void mover(item, "en_espera")}
                onLlamarConsulta={() => void mover(item, "en_consulta")}
                onFinalizar={() => void mover(item, "atendido")}
              />
            ))}
          </ul>
        </section>
      )}

      {cobroItem && (
        <CobroModal
          item={cobroItem}
          busy={busyId === cobroItem.id}
          onCancel={() => setCobroItem(null)}
          onConfirm={(metodo) => void mover(cobroItem, "en_espera", metodo)}
        />
      )}
    </div>
  )
}

function CitaCard({
  item,
  busy,
  onCobrar,
  onMarcarLlegada,
  onLlamarConsulta,
  onFinalizar,
}: {
  item: DailyAppointmentItem
  busy: boolean
  onCobrar: () => void
  onMarcarLlegada: () => void
  onLlamarConsulta: () => void
  onFinalizar: () => void
}) {
  const meta = metaEstado(item.estado)
  const hora = horaCita(item)
  const turno = item.turno ? ` · Turno ${ETIQUETA_TURNO[item.turno]}` : ""

  return (
    <li className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold">{nombrePaciente(item)}</span>
          <span className="text-xs text-muted-foreground">
            {item.paciente?.cedula ? `C.I. ${item.paciente.cedula} · ` : ""}
            {nombreEspecialista(item)}
            {item.especialista ? ` · ${item.especialista.especialidad}` : ""}
          </span>
          <span className="text-xs text-muted-foreground">
            {hora ? `${hora} hs` : "Hora por confirmar"}
            {turno}
          </span>
        </div>
        <Badge className={cn("gap-1.5", meta.badge)}>
          <span className={cn("size-1.5 rounded-full", meta.dot)} />
          {meta.label}
        </Badge>
      </div>

      {busy && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LoaderCircle className="size-3.5 animate-spin" />
          Actualizando estado…
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {item.estado === "pago_en_recepcion" && (
          <Button onClick={onCobrar} disabled={busy} className="gap-1.5">
            Marcar Llegada <span aria-hidden="true">📍</span>
          </Button>
        )}
        {item.estado === "confirmada" && (
          <Button onClick={onMarcarLlegada} disabled={busy} className="gap-1.5">
            Marcar Llegada <span aria-hidden="true">📍</span>
          </Button>
        )}
        {item.estado === "en_espera" && (
          <Button onClick={onLlamarConsulta} disabled={busy} className="gap-1.5">
            Llamar a Consulta <span aria-hidden="true">🩺</span>
          </Button>
        )}
        {item.estado === "en_consulta" && (
          <Button onClick={onFinalizar} disabled={busy} className="gap-1.5">
            Finalizar Cita <span aria-hidden="true">✅</span>
          </Button>
        )}
      </div>
    </li>
  )
}