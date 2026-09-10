"use client"

/**
 * Paso 2 del wizard: selección de especialidad y especialista del tenant.
 *
 * Flujo:
 *  1. El paciente elige la ESPECIALIDAD (Cardiología, Pediatría…).
 *  2. Se despliegan los especialistas de esa especialidad con su ficha:
 *     nombre, foto/avatar y horarios semanales disponibles (`schedules`).
 *  3. Al tocar un especialista se guarda la selección y se habilita
 *     «Continuar» hacia el Paso 3 (Fecha y hora).
 */
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  BadgeCheck,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Stethoscope,
} from "lucide-react"

import type { Doctor, PlanTenant } from "@/types/database"
import type { DoctorSchedule, DoctorWithTenant } from "@/types/booking"
import { getDoctorsByTenant } from "@/app/actions/booking"
import { doctorNombre, formatUSD, iniciales } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Props = {
  clinicSlug: string
  selectedDoctor?: Doctor | null
  /** Plan del tenant: 'independiente' salta la selección de especialista. */
  planType?: PlanTenant | null
  onContinue: (doctor: Doctor) => void
}

/* ------------------------------------------------------------------ */
/* Helpers de horarios                                                 */
/* ------------------------------------------------------------------ */

/** 0=Domingo … 6=Sábado (mismo índice que JS `getDay()`). */
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const

/** "08:30" → "8:30 am". */
function formatHora12(hora: string): string {
  const [horaRaw, minutoRaw] = hora.split(":").map(Number)
  const periodo = horaRaw >= 12 ? "pm" : "am"
  const hora12 = horaRaw % 12 === 0 ? 12 : horaRaw % 12
  return `${hora12}:${String(minutoRaw ?? 0).padStart(2, "0")} ${periodo}`
}

/** Resumen corto de una fila de `schedules`: "Lun 8:00 am – 12:00 pm". */
function horarioResumen(horario: DoctorSchedule): string | null {
  if (horario.dia_semana < 0 || horario.dia_semana > 6) return null
  return `${DIAS_CORTOS[horario.dia_semana]} ${formatHora12(
    horario.hora_inicio
  )}–${formatHora12(horario.hora_fin)}`
}

/* ------------------------------------------------------------------ */
/* Avatar y ficha del especialista                                      */
/* ------------------------------------------------------------------ */

function DoctorAvatar({
  doctor,
  className,
}: {
  doctor: DoctorWithTenant
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  const src = doctor.foto_url

  if (!src || broken) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-muted font-bold text-muted-foreground",
          className
        )}
        aria-hidden
      >
        {iniciales(doctor.nombres, doctor.apellidos)}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Fotos subidas por el tenant (URL dinámica en Supabase Storage).
    <img
      src={src}
      alt={`Foto de ${doctorNombre(doctor)}`}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={cn("rounded-full object-cover", className)}
    />
  )
}

function DoctorCard({
  doctor,
  selected,
  onSelect,
}: {
  doctor: DoctorWithTenant
  selected: boolean
  onSelect: () => void
}) {
  const horarios = doctor.schedules
    .map(horarioResumen)
    .filter((item): item is string => item !== null)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full flex-col gap-3 rounded-2xl border bg-card p-3.5 text-left transition-all",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.99]",
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
          : "border-border hover:bg-muted/40"
      )}
    >
      <span className="flex items-center gap-3">
        <DoctorAvatar doctor={doctor} className="size-14" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 font-semibold">
            {doctorNombre(doctor)}
            <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verificado" />
          </span>
          <span className="text-xs font-medium text-primary">
            {doctor.especialidad}
          </span>
          {doctor.precio_consulta > 0 && (
            <span className="text-xs text-muted-foreground">
              Consulta {formatUSD(doctor.precio_consulta)}
            </span>
          )}
        </span>
        <ChevronRight
          className={cn(
            "size-5 shrink-0",
            selected ? "text-primary" : "text-muted-foreground/50"
          )}
        />
      </span>

      {horarios.length > 0 ? (
        <span className="flex flex-col gap-1.5 border-t border-dashed pt-2.5">
          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock3 className="size-3.5" aria-hidden="true" />
            Horarios disponibles
          </span>
          <span className="flex flex-wrap gap-1.5">
            {horarios.map((item, index) => (
              <span
                key={`${doctor.id}-${index}`}
                className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                {item}
              </span>
            ))}
          </span>
        </span>
      ) : (
        <span className="border-t border-dashed pt-2.5 text-xs text-muted-foreground">
          Horarios por definir con la clínica.
        </span>
      )}
    </button>
  )
}

type DoctorsLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; doctors: DoctorWithTenant[] }

export function StepDoctorSelect({
  clinicSlug,
  selectedDoctor,
  planType,
  onContinue,
}: Props) {
  const [attempt, setAttempt] = useState(0)
  const [load, setLoad] = useState<DoctorsLoadState>({ status: "loading" })
  const [selected, setSelected] = useState<Doctor | null>(
    selectedDoctor ?? null
  )
  const [activeEsp, setActiveEsp] = useState<string | null>(
    selectedDoctor?.especialidad ?? null
  )
  /** Evita disparar más de una vez la asignación automática (Plan Pro). */
  const autoRef = useRef(false)

  useEffect(() => {
    let active = true

    getDoctorsByTenant(clinicSlug).then((result) => {
      if (!active) return
      if (result.ok) {
        setLoad({ status: "ok", doctors: result.data })
      } else {
        setLoad({ status: "error", message: result.message })
      }
    })

    return () => {
      active = false
    }
  }, [clinicSlug, attempt])

  // Plan Médico Pro ('independiente'): asigna el único especialista y avanza.
  useEffect(() => {
    if (planType !== "independiente") return
    if (load.status !== "ok" || load.doctors.length !== 1) return
    if (autoRef.current) return
    autoRef.current = true
    onContinue(load.doctors[0])
  }, [planType, load, onContinue])

  const loading = load.status === "loading"
  const loadError = load.status === "error" ? load.message : null
  const doctors = useMemo(
    () => (load.status === "ok" ? load.doctors : []),
    [load]
  )

  /** Especialistas agrupados por su campo `especialidad`. */
  const grupos = useMemo(() => {
    const porEspecialidad = new Map<string, DoctorWithTenant[]>()
    for (const doctor of doctors) {
      const lista = porEspecialidad.get(doctor.especialidad) ?? []
      lista.push(doctor)
      porEspecialidad.set(doctor.especialidad, lista)
    }

    return Array.from(porEspecialidad.entries())
      .map(([especialidad, items]) => ({
        especialidad,
        items: [...items].sort((a, b) =>
          doctorNombre(a).localeCompare(doctorNombre(b), "es")
        ),
      }))
      .sort((a, b) => a.especialidad.localeCompare(b.especialidad, "es"))
  }, [doctors])

  const activeGroup =
    grupos.find((grupo) => grupo.especialidad === activeEsp) ?? null
  const listaDeEspecialidades = !activeGroup

  /** Cambia la especialidad activa; limpia la selección si ya no coincide. */
  function elegirEspecialidad(especialidad: string) {
    if (especialidad === activeEsp) return
    setActiveEsp(especialidad)
    setSelected((prev) =>
      prev && prev.especialidad === especialidad ? prev : null
    )
  }

  const pluralEspecialistas = (cantidad: number) =>
    `${cantidad} ${cantidad === 1 ? "especialista" : "especialistas"}`

  // Plan Médico Pro: sin selector. Se muestra un aviso mientras el único
  // especialista se asigna automáticamente y se avanza al horario.
  if (planType === "independiente") {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h2 className="text-xl font-semibold tracking-tight">
            Asignando especialista
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta clínica trabaja con un especialista único. Te llevamos directo
            a elegir fecha y horario.
          </p>
        </header>

        {loadError ? (
          <div className="flex flex-col gap-3">
            <Alert variant="destructive">
              <AlertTitle>No pudimos cargar la agenda</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
            <Button
              variant="outline"
              onClick={() => {
                setLoad({ status: "loading" })
                setAttempt((n) => n + 1)
              }}
            >
              Reintentar
            </Button>
          </div>
        ) : !loading && doctors.length === 0 ? (
          <Alert>
            <AlertTitle>Aún no hay especialista disponible</AlertTitle>
            <AlertDescription>
              La clínica está configurando su agenda. Intenta más tarde.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h2 className="text-xl font-semibold tracking-tight">
            Elige al especialista
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            Consultando especialistas disponibles…
          </p>
        </header>
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h2 className="text-xl font-semibold tracking-tight">
            Elige al especialista
          </h2>
        </header>
        <Alert variant="destructive">
          <AlertTitle>No pudimos cargar los especialistas</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          onClick={() => {
            setLoad({ status: "loading" })
            setAttempt((n) => n + 1)
          }}
        >
          Reintentar
        </Button>
      </div>
    )
  }

    return (
    <div className="flex flex-col gap-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">
          Elige al especialista
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {listaDeEspecialidades
            ? "Primero elige la especialidad y luego verás sus especialistas y horarios disponibles."
            : `Estos son los especialistas en ${activeGroup!.especialidad}.`}
        </p>
      </header>

      {listaDeEspecialidades ? (
        /* ---------- Vista 1: lista de especialidades ---------- */
        <section
          className="flex flex-col gap-2"
          aria-label="Especialidades disponibles"
        >
          {grupos.length === 0 ? (
            <Alert>
              <AlertTitle>Sin especialistas disponibles</AlertTitle>
              <AlertDescription>
                No encontramos especialistas para esta clínica en este momento.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {grupos.length}{" "}
                {grupos.length === 1 ? "especialidad" : "especialidades"}{" "}
                disponibles
              </p>
              {grupos.map((grupo) => {
                const tieneSeleccion =
                  selected?.especialidad === grupo.especialidad
                return (
                  <button
                    key={grupo.especialidad}
                    type="button"
                    onClick={() => elegirEspecialidad(grupo.especialidad)}
                    aria-pressed={activeEsp === grupo.especialidad}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border bg-card p-3.5 text-left transition-all",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.99]",
                      tieneSeleccion
                        ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                        : "border-border hover:bg-muted/40"
                    )}
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Stethoscope className="size-5" aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-semibold">{grupo.especialidad}</span>
                      <span className="text-xs text-muted-foreground">
                        {pluralEspecialistas(grupo.items.length)}
                        {tieneSeleccion
                          ? ` · ${doctorNombre(selected!)}`
                          : " disponibles"}
                      </span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground/50" />
                  </button>
                )
              })}
            </>
          )}
        </section>
      ) : (
        /* ---------- Vista 2: especialistas de la especialidad ---------- */
        <section
          className="flex flex-col gap-2"
          aria-label={`Especialistas de ${activeGroup!.especialidad}`}
        >
          <Button
            type="button"
            variant="ghost"
            onClick={() => setActiveEsp(null)}
            className="-mx-2 w-fit gap-1.5 px-2 text-sm text-muted-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Cambiar especialidad
          </Button>

          <p className="text-xs text-muted-foreground">
            {pluralEspecialistas(activeGroup!.items.length)} · toca la tarjeta para
            seleccionar
          </p>

          <div className="flex flex-col gap-2">
            {activeGroup!.items.map((doctor) => (
              <DoctorCard
                key={doctor.id}
                doctor={doctor}
                selected={selected?.id === doctor.id}
                onSelect={() => setSelected(doctor)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Pie fijo: avanza al Paso 3 (Fecha y hora) */}
      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 backdrop-blur">
        <Button
          type="button"
          disabled={!selected}
          onClick={() => selected && onContinue(selected)}
          className="h-12 w-full gap-2 rounded-xl text-base"
        >
          {selected
            ? `Continuar con ${doctorNombre(selected)}`
            : "Selecciona un especialista"}
          {selected ? (
            <ChevronRight className="size-4" />
          ) : (
            <LoaderCircle className="size-4 opacity-40" aria-hidden="true" />
          )}
        </Button>
        {!selected && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {listaDeEspecialidades
              ? "Primero elige la especialidad de tu consulta"
              : "Toca la tarjeta de un especialista para continuar"}
          </p>
        )}
      </div>
    </div>
  )
}