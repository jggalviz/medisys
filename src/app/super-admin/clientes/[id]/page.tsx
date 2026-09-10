import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ArrowLeft, CalendarClock, CalendarX2, ExternalLink, Stethoscope } from "lucide-react"

import { getClienteDetalle } from "@/app/actions/super-admin-clientes"
import { formatUSD } from "@/lib/format"
import {
  evaluarMembresia,
  formatearVencimiento,
  nombrePlan,
  precioPlanUSD,
} from "@/lib/suscripcion"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Detalle del cliente | Medisys",
  robots: { index: false },
}

type Props = { params: Promise<{ id: string }> }

function fechaHora(iso: string): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function fechaCorta(iso: string | null): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

export default async function ClienteDetallePage({ params }: Props) {
  const { id } = await params
  const resultado = await getClienteDetalle(id)
  if (!resultado.ok) notFound()

  const cliente = resultado.data
  const membresia = evaluarMembresia(cliente.suscripcionVenceAt)
  const activos = cliente.doctores.filter((d) => d.activo).length

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/super-admin/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver al dashboard
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
            {cliente.nombre.charAt(0).toUpperCase()}
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight">{cliente.nombre}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono text-muted-foreground">/{cliente.slug}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-semibold",
                  cliente.planType === "PRO"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : "bg-primary/10 text-primary"
                )}
              >
                {nombrePlan(cliente.planType)}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-semibold",
                  cliente.isActive
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : "bg-red-500/15 text-red-700 dark:text-red-400"
                )}
              >
                {cliente.isActive ? "Activo" : "Inactivo"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/${cliente.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted/50"
          >
            <ExternalLink className="size-4" />
            Ver página pública
          </a>
          <a
            href={`/${cliente.slug}/admin`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ExternalLink className="size-4" />
            Abrir panel interno
          </a>
        </div>
      </header>

      {/* Resumen */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta
          titulo="Especialistas"
          valor={`${activos}/${cliente.maxEspecialistas}`}
          detalle="activos / cupo del plan"
        />
        <Tarjeta
          titulo="Citas activas"
          valor={String(cliente.citasActivas.length)}
          detalle="en cola o pendientes"
        />
        <Tarjeta
          titulo="Citas históricas"
          valor={String(cliente.totalCitas)}
          detalle="total registradas"
        />
        <Tarjeta
          titulo="Suscripción"
          valor={
            membresia.tieneFecha
              ? membresia.vencida
                ? "Vencida"
                : `${membresia.dias} días`
              : "Sin fecha"
          }
          detalle={`Vence ${formatearVencimiento(cliente.suscripcionVenceAt)}`}
          alerta={membresia.debeAvisar}
        />
      </section>

      {/* Datos generales */}
      <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
        <Dato label="Teléfono" valor={cliente.telefono ?? "—"} />
        <Dato label="RIF" valor={cliente.rif ?? "—"} />
        <Dato label="Dirección" valor={cliente.direccion ?? "—"} />
        <Dato label="Alta en Medisys" valor={fechaCorta(cliente.createdAt)} />
        <Dato
          label="Plan contratado"
          valor={`${nombrePlan(cliente.planType)} · ${formatUSD(precioPlanUSD(cliente.planType))}/mes`}
        />
        <Dato
          label="Vencimiento de membresía"
          valor={formatearVencimiento(cliente.suscripcionVenceAt)}
        />
      </section>

      {/* Especialistas */}
      <section className="rounded-2xl border bg-card">
        <h2 className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold">
          <Stethoscope className="size-4 text-primary" />
          Médicos asociados ({cliente.doctores.length})
        </h2>
        {cliente.doctores.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Este cliente todavía no registra especialistas.
          </p>
        ) : (
          <ul className="divide-y">
            {cliente.doctores.map((doctor) => (
              <li
                key={doctor.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{doctor.nombre}</span>
                  <span className="text-xs text-muted-foreground">
                    {doctor.especialidad} · {formatUSD(doctor.precioConsulta)}
                  </span>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    doctor.activo
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400"
                  )}
                >
                  {doctor.activo ? "Activo" : "Inactivo"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Citas activas */}
      <section className="rounded-2xl border bg-card">
        <h2 className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold">
          <CalendarClock className="size-4 text-primary" />
          Citas activas ({cliente.citasActivas.length})
        </h2>
        {cliente.citasActivas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <CalendarX2 className="size-6 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Sin citas activas.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {cliente.citasActivas.map((cita) => (
              <li
                key={cita.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{cita.doctorNombre}</span>
                  <span className="text-xs text-muted-foreground">
                    {fechaHora(cita.fechaHora)}
                  </span>
                </div>
                <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  {cita.estado}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Tarjeta({
  titulo,
  valor,
  detalle,
  alerta = false,
}: {
  titulo: string
  valor: string
  detalle: string
  alerta?: boolean
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-1 rounded-2xl border bg-card p-3.5",
        alerta &&
          "border-amber-300/70 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-950/30"
      )}
    >
      <span className="text-[12px] font-medium text-muted-foreground">{titulo}</span>
      <span className="text-xl font-bold tracking-tight">{valor}</span>
      <span className="text-[11px] text-muted-foreground">{detalle}</span>
    </article>
  )
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border bg-background px-3 py-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-medium">{valor}</span>
    </div>
  )
}
