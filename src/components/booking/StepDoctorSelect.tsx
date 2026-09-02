"use client"

/**
 * Paso 2 del wizard: selección de especialidad y médico del tenant.
 * Trae los doctores activos vía Server Action y permite filtrar por
 * especialidad con chips; cada tarjeta muestra foto, badges y precio.
 */
import { useEffect, useMemo, useState } from "react"
import { BadgeCheck, ChevronRight, LoaderCircle, Stethoscope, X } from "lucide-react"

import type { Doctor } from "@/types/database"
import { getDoctorsByTenant } from "@/app/actions/booking"
import { doctorNombre, formatMonto, iniciales } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Props = {
  clinicSlug: string
  selectedDoctor?: Doctor | null
  onContinue: (doctor: Doctor) => void
}

function DoctorAvatar({
  doctor,
  className,
}: {
  doctor: Doctor
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  const src = doctor.foto_url

  if (!src || broken) {
    return (
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-muted font-bold text-muted-foreground",
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
  doctor: Doctor
  selected: boolean
  onSelect: () => void
}) {
  const badges = [doctor.especialidad, ...doctor.especialidades]

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
        <DoctorAvatar doctor={doctor} className="size-14 shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 font-semibold">
            {doctorNombre(doctor)}
            <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verificado" />
          </span>
          <span className="text-xs font-medium text-primary">
            {doctor.especialidad}
          </span>
          <span className="text-xs text-muted-foreground">
            Consulta {formatMonto(doctor.precio_consulta)}
          </span>
        </span>
        <ChevronRight
          className={cn(
            "size-5 shrink-0",
            selected ? "text-primary" : "text-muted-foreground/50"
          )}
        />
      </span>

      {badges.length > 1 && (
        <span className="flex flex-wrap gap-1.5">
          {badges.slice(1).map((badge) => (
            <Badge key={badge} variant="secondary">
              {badge}
            </Badge>
          ))}
        </span>
      )}
    </button>
  )
}

type DoctorsLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; doctors: Doctor[] }

export function StepDoctorSelect({
  clinicSlug,
  selectedDoctor,
  onContinue,
}: Props) {
  const [attempt, setAttempt] = useState(0)
  const [load, setLoad] = useState<DoctorsLoadState>({ status: "loading" })
  const [selected, setSelected] = useState<Doctor | null>(selectedDoctor ?? null)
  const [especialidad, setEspecialidad] = useState<string>("todas")

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

  const loading = load.status === "loading"
  const loadError = load.status === "error" ? load.message : null
  const doctors = useMemo(() => (load.status === "ok" ? load.doctors : []), [load])

  const especialidades = useMemo(() => {
    return Array.from(
      new Set(
        doctors.flatMap((doctor) => [doctor.especialidad, ...doctor.especialidades])
      )
    ).sort((a, b) => a.localeCompare(b, "es"))
  }, [doctors])

  const filtered = useMemo(() => {
    if (especialidad === "todas") return doctors
    return doctors.filter(
      (doctor) =>
        doctor.especialidad === especialidad ||
        doctor.especialidades.includes(especialidad)
    )
  }, [doctors, especialidad])

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h2 className="text-xl font-semibold tracking-tight">
            Elige al especialista
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Consultando médicos disponibles…</p>
        </header>
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-[110px] w-full" />
          <Skeleton className="h-[110px] w-full" />
          <Skeleton className="h-[110px] w-full" />
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
          <AlertTitle>No pudimos cargar los médicos</AlertTitle>
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
          Filtra por especialidad y toca la tarjeta del médico.
        </p>
      </header>

      {especialidades.length > 0 && (
        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Filtrar por especialidad"
        >
          <button
            type="button"
            role="tab"
            aria-selected={especialidad === "todas"}
            onClick={() => setEspecialidad("todas")}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1 rounded-full border px-4 text-sm font-medium transition-colors",
              especialidad === "todas"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted/50"
            )}
          >
            <Stethoscope className="size-4" />
            Todos
          </button>
          {especialidades.map((esp) => (
            <button
              key={esp}
              type="button"
              role="tab"
              aria-selected={especialidad === esp}
              onClick={() => setEspecialidad(esp)}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1 rounded-full border px-4 text-sm font-medium transition-colors",
                especialidad === esp
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted/50"
              )}
            >
              {esp}
              {especialidad === esp && (
                <X
                  className="size-3.5 opacity-70"
                  aria-label={`Quitar filtro ${esp}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    setEspecialidad("todas")
                  }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <Alert>
          <AlertTitle>Sin médicos disponibles</AlertTitle>
          <AlertDescription>
            No encontramos especialistas para esta clínica en este momento.
          </AlertDescription>
        </Alert>
      ) : (
        <section className="flex flex-col gap-2" aria-label="Resultados de médicos">
          <p className="text-xs text-muted-foreground">
            {filtered.length} médico{filtered.length === 1 ? "" : "s"} disponible
            {filtered.length === 1 ? "" : "s"}
          </p>
          <div className="flex flex-col gap-2">
            {filtered.map((doctor) => (
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

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 backdrop-blur">
        <Button
          type="button"
          disabled={!selected}
          onClick={() => selected && onContinue(selected)}
          className="h-12 w-full gap-2 rounded-xl text-base"
        >
          {selected ? `Continuar con ${doctorNombre(selected)}` : "Selecciona un médico"}
          {selected ? (
            <ChevronRight className="size-4" />
          ) : (
            <LoaderCircle className="size-4 opacity-40" />
          )}
        </Button>
        {!selected && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Toca un médico para continuar
          </p>
        )}
      </div>
    </div>
  )
}

