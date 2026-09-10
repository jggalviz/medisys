import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Hourglass,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react"

import type { AppointmentStatus } from "@/types/database"
import type { AdminPatient, DailyAppointmentItem } from "@/types/admin"
import type { DashboardKpis } from "@/app/actions/dashboard"
import { getDashboardKpis } from "@/app/actions/dashboard"
import { getDailyAppointments } from "@/app/actions/admin"
import { getTenantBySlug } from "@/app/actions/tenant"
import { TarjetaRecaudacion } from "@/components/admin/dashboard/TarjetaRecaudacion"
import { BannerMembresia } from "@/components/admin/suscripcion/BannerMembresia"
import { evaluarMembresia, nombrePlan } from "@/lib/suscripcion"
import { createClient } from "@/lib/supabase/server"
import { getStaffForSlug } from "@/lib/staff"
import { toISODate } from "@/lib/date"
import { cn } from "@/lib/utils"

type AdminPageProps = {
  params: Promise<{ clinicSlug: string }>
}

export const metadata: Metadata = {
  title: "Panel de la clínica | Medisys",
  robots: { index: false },
}

/* ------------------------------------------------------------------ */
/* Chip de estado                                                      */
/* ------------------------------------------------------------------ */

const CHIP_ESTADO: Record<AppointmentStatus, { label: string; className: string }> = {
  pendiente: {
    label: "Pendiente",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  pendiente_validacion: {
    label: "Por validar",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  pago_en_recepcion: {
    label: "Pago en caja",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  confirmada: {
    label: "Verificado",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  en_espera: {
    label: "En espera",
    className: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  },
  en_consulta: {
    label: "En consulta",
    className: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
  },
  atendido: {
    label: "Atendido",
    className: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
  },
  completada: {
    label: "Completada",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  cancelada: {
    label: "Cancelada",
    className: "bg-red-500/15 text-red-700 dark:text-red-400",
  },
  expirada: {
    label: "Expirada",
    className: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
  },
  pago_rechazado: {
    label: "Pago rechazado",
    className: "bg-red-500/15 text-red-700 dark:text-red-400",
  },
}

function nombrePaciente(item: DailyAppointmentItem): string {
  const p = item.paciente
  if (!p) return "Paciente invitado"
  return (
    [p.nombres, p.apellidos].filter(Boolean).join(" ").trim() || "Sin nombre"
  )
}

function nombreEspecialista(item: DailyAppointmentItem): string {
  const d = item.especialista
  if (!d) return "Especialista"
  return (
    [d.nombres, d.apellidos].filter(Boolean).join(" ").trim() ||
    d.especialidad
  )
}

function infoPaciente(p: AdminPatient | null): string {
  if (!p) return "Cita de invitado sin perfil"
  return (
    [p.cedula ? `C.I. ${p.cedula}` : null, p.telefono]
      .filter(Boolean)
      .join(" · ") || "Paciente sin contacto"
  )
}

function horaDe(fechaHora: string): string {
  return fechaHora.slice(11, 16) || "--:--"
}

/* ------------------------------------------------------------------ */
/* Página (server component, sin estado local)                         */
/* ------------------------------------------------------------------ */

export default async function AdminPage({ params }: AdminPageProps) {
  const { clinicSlug } = await params

  const tenant = await getTenantBySlug(clinicSlug)
  if (!tenant) notFound()

  const supabase = await createClient()
  const staff = await getStaffForSlug(supabase, clinicSlug)
  if (!staff) redirect(`/${clinicSlug}/login`)

  if (staff.role !== "admin" && staff.role !== "recepcion") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl items-center px-4">
        <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed bg-card p-8 text-center">
          <ShieldAlert className="size-8 text-amber-600" />
          <p className="text-lg font-semibold">Acceso restringido</p>
          <p className="text-sm text-muted-foreground">
            El panel está disponible solo para administradores y recepción.
          </p>
        </div>
      </main>
    )
  }

  const dateISO = toISODate(new Date())
  const [kpisResult, citasResult] = await Promise.all([
    getDashboardKpis(tenant.id, dateISO),
    getDailyAppointments({ tenantId: tenant.id, date: dateISO }),
  ])

  const kpis: DashboardKpis | null = kpisResult.ok ? kpisResult.data : null
  const citas: DailyAppointmentItem[] = citasResult.ok
    ? [...citasResult.data]
        .sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora))
        .slice(0, 7)
    : []
  const errorKpis = kpisResult.ok ? null : kpisResult.message
  const errorCitas = citasResult.ok ? null : citasResult.message

  const fechaLegible = new Intl.DateTimeFormat("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${dateISO}T12:00:00-04:00`))

  const tarjetas = kpis
    ? [
        {
          id: "total",
          titulo: "Citas hoy",
          icono: <CalendarClock className="size-5" />,
          valor: String(kpis.totalCitas),
          subtexto: `${kpis.enCola} por atender · ${kpis.atendidas} atendidas`,
          destacado: false,
        },
        {
          id: "cola",
          titulo: "En cola / pendientes",
          icono: <Hourglass className="size-5" />,
          valor: String(kpis.enCola),
          subtexto: "Esperando pago, llegada o consulta",
          destacado: false,
        },
        {
          id: "atendidas",
          titulo: "Atendidas",
          icono: <CheckCircle2 className="size-5" />,
          valor: String(kpis.atendidas),
          subtexto: `${kpis.canceladas} canceladas en el día`,
          destacado: false,
        },
      ]
    : null

  const accesos = [
    {
      href: `/${clinicSlug}/admin/recepcion`,
      titulo: "Recepción",
      descripcion: "Cola, llegadas, cobros y consultas",
      icono: <CalendarClock className="size-5" />,
    },
    {
      href: `/${clinicSlug}/admin/pagos`,
      titulo: "Pagos",
      descripcion: "Validar comprobantes en línea",
      icono: <ShieldCheck className="size-5" />,
    },
    {
      href: `/${clinicSlug}/admin/especialistas`,
      titulo: "Especialistas",
      descripcion: "Equipo médico y horarios",
      icono: <Stethoscope className="size-5" />,
    },
    {
      href: `/${clinicSlug}/admin/configuracion`,
      titulo: "Configuración",
      descripcion: "Datos, Pago Móvil y branding",
      icono: <Building2 className="size-5" />,
    },
  ]

  const membresia = evaluarMembresia(tenant.suscripcion_vence_at)

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      {/* Encabezado */}
      <header className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Users className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {clinicSlug} · Panel de gestión
          </span>
          <h1 className="truncate text-lg font-semibold tracking-tight">
            Buen día, {staff.role === "admin" ? "Administrador" : "Recepción"}
          </h1>
          <p className="text-sm capitalize text-muted-foreground">
            {fechaLegible} · vista general del día
          </p>
        </div>
        <Link
          href={`/${clinicSlug}/admin/recepcion`}
          className="hidden shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:inline-flex"
        >
          <CalendarClock className="size-4" />
          Abrir recepción
        </Link>
      </header>

      {membresia.debeAvisar && (
        <BannerMembresia
          clinicSlug={clinicSlug}
          planLabel={nombrePlan(tenant.plan_type)}
          venceAt={tenant.suscripcion_vence_at ?? null}
          dias={membresia.dias}
          vencida={membresia.vencida}
        />
      )}

      {(errorKpis || errorCitas) && (
        <section
          role="alert"
          className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300"
        >
          <p className="font-medium">No se pudieron cargar algunas métricas.</p>
          <p className="mt-1 opacity-90">
            {[errorKpis, errorCitas].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-2 opacity-80">
            Reintenta recargando la página. La información se actualiza con
            cada reserva o movimiento de recepción.
          </p>
        </section>
      )}

      {/* KPIs del día */}
      <section
        aria-label="Métricas del día"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {tarjetas
          ? (
            <>
              {tarjetas.map((tarjeta) => (
              <article
                key={tarjeta.id}
                className={cn(
                  "flex flex-col gap-3 rounded-2xl border bg-card p-4",
                  tarjeta.destacado &&
                    "border-primary/40 bg-gradient-to-br from-card to-primary/5"
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl",
                    tarjeta.destacado
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  {tarjeta.icono}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[13px] font-medium text-muted-foreground">
                    {tarjeta.titulo}
                  </span>
                  <span className="truncate text-2xl font-bold tracking-tight tabular-nums">
                    {tarjeta.valor}
                  </span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {tarjeta.subtexto}
                  </span>
                </div>
              </article>
              ))}
              {/* Tarjeta financiera con conmutación USD / VES */}
              <TarjetaRecaudacion
                ingresosUsd={kpis?.ingresos.usd ?? 0}
                porValidarUsd={kpis?.recaudacion.porValidar ?? 0}
                tasaBCV={kpis?.tasaBCV ?? 36.5}
              />
            </>
          )
          : [0, 1, 2, 3].map((clave) => <SkeletonCard key={clave} />)}
      </section>

      {/* Acceso rápido */}
      <section aria-label="Accesos rápidos" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Gestión rápida
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {accesos.map((acceso) => (
            <Link
              key={acceso.href}
              href={acceso.href}
              className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-muted/40"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {acceso.icono}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-semibold">{acceso.titulo}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">
                  {acceso.descripcion}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground/40" />
            </Link>
          ))}
        </div>
      </section>

      {/* Próximas citas del día */}
      <section
        aria-label="Próximas citas del día"
        className="flex flex-col gap-3"
      >
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Próximas citas del día
          </h2>
          <Link
            href={`/${clinicSlug}/admin/recepcion`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Ver cola completa
          </Link>
        </div>

        {citas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card px-4 py-10 text-center">
            <CalendarClock className="size-7 text-muted-foreground/50" />
            <p className="text-sm font-medium">Sin citas para hoy</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Cuando los pacientes reserven un cupo aparecerá aquí la agenda
              del día en orden de horario.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-2xl border bg-card">
            {citas.map((cita, index) => {
              const chip = CHIP_ESTADO[cita.estado]
              return (
                <li
                  key={cita.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    index !== citas.length - 1 && "border-b"
                  )}
                >
                  <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">
                    {horaDe(cita.fecha_hora)}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">
                      {nombrePaciente(cita)}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {nombreEspecialista(cita)} · {infoPaciente(cita.paciente)}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                      chip.className
                    )}
                  >
                    {chip.label}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Pie */}
      <nav className="flex flex-col gap-2 border-t pt-4">
        <Link
          href={`/${clinicSlug}`}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-medium transition-colors hover:bg-muted/40"
        >
          <ArrowLeft className="size-4" />
          Volver a la página de reserva
        </Link>
      </nav>

    </main>
  )
}

function SkeletonCard() {
  return (
    <div className="flex animate-pulse flex-col gap-3 rounded-2xl border bg-card p-4">
      <span className="size-9 rounded-xl bg-muted" />
      <div className="flex flex-col gap-1.5">
        <span className="h-3 w-3/4 rounded bg-muted" />
        <span className="h-6 w-1/2 rounded bg-muted" />
        <span className="h-3 w-2/3 rounded bg-muted" />
      </div>
    </div>
  )
}

