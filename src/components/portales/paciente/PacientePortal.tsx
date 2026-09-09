"use client"

/** Portal del paciente: Mis Citas · Historial Médico · Mis Pagos. */
import { useEffect, useState } from "react"
import { CalendarClock, CreditCard, FileHeart, LogOut, UserRound } from "lucide-react"

import { getDatosPaciente, type DatosPaciente } from "@/app/actions/paciente-portal"
import { logoutPortal } from "@/app/actions/portal-auth"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Props = { clinicSlug: string }
type Tab = "citas" | "historial" | "pagos"

const ESTADO_LABEL: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente", clase: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  pendiente_validacion: { texto: "Por validar", clase: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  pago_en_recepcion: { texto: "Pago en caja", clase: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  confirmada: { texto: "Confirmada", clase: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  en_espera: { texto: "En espera", clase: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
  en_consulta: { texto: "En consulta", clase: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400" },
  atendido: { texto: "Atendida", clase: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400" },
  completada: { texto: "Completada", clase: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  cancelada: { texto: "Cancelada", clase: "bg-red-500/15 text-red-700 dark:text-red-400" },
  expirada: { texto: "Expirada", clase: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400" },
  pago_rechazado: { texto: "Pago rechazado", clase: "bg-red-500/15 text-red-700 dark:text-red-400" },
}

function badgeEstado(estado: string) {
  const meta = ESTADO_LABEL[estado]
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium capitalize", meta?.clase ?? "bg-muted text-muted-foreground")}>
      {meta?.texto ?? estado}
    </span>
  )
}

function insigniaPago(estado: string | null) {
  if (estado === "aprobado")
    return <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Aprobado</span>
  if (estado === "por_validar")
    return <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">Por validar</span>
  if (estado === "rechazado")
    return <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-medium text-red-700 dark:text-red-400">Rechazado</span>
  return null
}

function formatoFecha(iso: string): string {
  if (!iso) return "Fecha por confirmar"
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso))
}

function formatoUsd(n: number): string {
  return `$ ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function formatoBs(n: number): string {
  return `Bs. ${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function PacientePortal({ clinicSlug }: Props) {
  const [tab, setTab] = useState<Tab>("citas")
  const [datos, setDatos] = useState<{ estado: "cargando" | "error" | "ok"; data?: DatosPaciente; mensaje?: string }>({ estado: "cargando" })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let activo = true
    getDatosPaciente().then((resultado) => {
      if (!activo) return
      if (resultado.ok) setDatos({ estado: "ok", data: resultado.data })
      else setDatos({ estado: "error", mensaje: resultado.message })
    })
    return () => { activo = false }
  }, [intento])

  const TABS: { id: Tab; label: string; icono: React.ReactNode }[] = [
    { id: "citas", label: "Mis Citas", icono: <CalendarClock className="size-4" /> },
    { id: "historial", label: "Historial Médico", icono: <FileHeart className="size-4" /> },
    { id: "pagos", label: "Mis Pagos", icono: <CreditCard className="size-4" /> },
  ]

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserRound className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              {datos.estado === "ok" ? datos.data?.paciente.nombre : "Mi Expediente"}
            </h1>
            <p className="text-sm text-muted-foreground">Portal del Paciente</p>
          </div>
        </div>
        <Button type="button" variant="outline" className="gap-2" onClick={() => void logoutPortal("paciente", clinicSlug)}>
          <LogOut className="size-4" />
          Cerrar Sesión
        </Button>
      </header>

      <nav aria-label="Secciones del paciente" className="flex flex-wrap gap-1.5">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted/60"
            )}
          >
            {item.icono}
            {item.label}
          </button>
        ))}
      </nav>

      {datos.estado === "cargando" && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      )}

      {datos.estado === "error" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <p>{datos.mensaje}</p>
          <Button variant="outline" onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </Button>
        </div>
      )}

      {datos.estado === "ok" && datos.data && tab === "citas" && (
        <section className="flex flex-col gap-2">
          {datos.data.citas.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
              Aún no tienes citas registradas.
            </p>
          ) : (
            datos.data.citas.map((cita) => (
              <article key={cita.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="font-semibold">{cita.especialista}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatoFecha(cita.fecha_hora)}
                  </p>
                </div>
                {badgeEstado(cita.estado)}
              </article>
            ))
          )}
        </section>
      )}

      {datos.estado === "ok" && datos.data && tab === "historial" && (
        <section className="flex flex-col gap-2">
          {datos.data.historial.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
              Aún no tienes consultas atendidas con historial.
            </p>
          ) : (
            datos.data.historial.map((item) => (
              <details key={item.id} className="rounded-2xl border bg-card px-4 py-3">
                <summary className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
                  <span>{formatoFecha(item.fecha_cita)} · {item.especialista}</span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                    Consulta atendida
                  </span>
                </summary>
                <dl className="mt-2 flex flex-col gap-1 border-t pt-2 text-sm">
                  {item.diagnostico && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Diagnóstico</dt>
                      <dd className="text-right font-medium">{item.diagnostico}</dd>
                    </div>
                  )}
                  {item.tratamiento && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Indicaciones / Receta</dt>
                      <dd className="max-w-[70%] text-right font-medium">{item.tratamiento}</dd>
                    </div>
                  )}
                  {item.notas && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Notas</dt>
                      <dd className="max-w-[70%] text-right">{item.notas}</dd>
                    </div>
                  )}
                </dl>
              </details>
            ))
          )}
        </section>
      )}

      {datos.estado === "ok" && datos.data && tab === "pagos" && (
        <section className="flex flex-col gap-2">
          {datos.data.pagos.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
              Aún no tienes pagos registrados.
            </p>
          ) : (
            datos.data.pagos
              .filter((pago) => pago.estadoPago !== null)
              .map((pago) => (
                <article key={pago.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-4">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="font-semibold">{pago.especialista}</p>
                    <p className="text-sm text-muted-foreground">{formatoFecha(pago.fecha_cita)}</p>
                    {pago.referencia && (
                      <p className="text-xs text-muted-foreground">Referencia: {pago.referencia}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="font-semibold tabular-nums">{formatoUsd(pago.montoUsd)}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatoBs(pago.montoVes)} · Tasa {pago.tasaBCV.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                    </p>
                    {insigniaPago(pago.estadoPago)}
                  </div>
                </article>
              ))
          )}
        </section>
      )}
    </div>
  )
}
