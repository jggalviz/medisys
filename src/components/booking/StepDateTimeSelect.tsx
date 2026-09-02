"use client"

/**
 * Paso 3 del wizard: calendario intermedio + bloques de horas disponibles.
 *
 * - Calendario mensual Mobile-First (sólo hacia adelante).
 * - Al elegir fecha llama a `getAvailableSlots(doctorId, fecha)` (Server
 *   Action) y pinta chips de horas; si una hora fue tomada por otro, la
 *   alerta visual avisa y se refresca la disponibilidad.
 * - El botón "Bloquear y pagar" crea la cita 'pendiente' con lock de
 *   15 minutos a través de `lockAppointmentSlot`.
 */
import { useEffect, useMemo, useState, useTransition } from "react"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  LoaderCircle,
  Lock,
  RefreshCw,
} from "lucide-react"

import type { Doctor, Profile } from "@/types/database"
import type { AvailableSlot, LockCreated } from "@/types/booking"
import { getAvailableSlots, lockAppointmentSlot } from "@/app/actions/booking"
import { toISODate } from "@/lib/date"
import { doctorNombre } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["do", "lu", "ma", "mi", "ju", "vi", "sá"]
const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

type Props = {
  doctor: Doctor
  patient: Profile
  /** Mensaje informativo (p. ej. "tu bloqueo expiró"). */
  notice?: string | null
  onLocked: (lock: LockCreated) => void
}

type DayCell = { day: number; iso: string } | null

function buildMonthDays(year: number, monthIdx: number): DayCell[] {
  const firstWeekDay = new Date(year, monthIdx, 1, 12).getDay()
  const totalDays = new Date(year, monthIdx + 1, 0, 12).getDate()

  const cells: DayCell[] = Array.from({ length: firstWeekDay }, () => null)
  for (let day = 1; day <= totalDays; day += 1) {
    const iso = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    cells.push({ day, iso })
  }
  return cells
}

function horaAmPm(hora: string): string {
  return new Intl.DateTimeFormat("es-VE", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(`2000-01-01T${hora}:00`))
}

export function StepDateTimeSelect({ doctor, patient, notice, onLocked }: Props) {
  const today = new Date()
  const todayISO = toISODate(today)

  const [year, setYear] = useState(today.getFullYear())
  const [monthIdx, setMonthIdx] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [chosenTime, setChosenTime] = useState<string | null>(null)
  const [slotsState, setSlotsState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; slots: AvailableSlot[] }
  >({ status: "idle" })
  const [attempt, setAttempt] = useState(0)
  const [lockError, setLockError] = useState<string | null>(null)
  const [isLocking, startLocking] = useTransition()

  const days = useMemo(() => buildMonthDays(year, monthIdx), [year, monthIdx])

  const isCurrentMonth =
    year === today.getFullYear() && monthIdx === today.getMonth()

  const slotsLoading = slotsState.status === "loading"
  const slotsError = slotsState.status === "error" ? slotsState.message : null
  const slots = slotsState.status === "ok" ? slotsState.slots : []

  // Carga los cupos del día seleccionado vía Server Action
  // (el setState ocurre dentro del callback asíncrono).
  useEffect(() => {
    if (!selectedDate) return
    let active = true

    getAvailableSlots(doctor.id, selectedDate).then((result) => {
      if (!active) return
      if (result.ok) {
        setSlotsState({ status: "ok", slots: result.data.slots })
      } else {
        setSlotsState({ status: "error", message: result.message })
      }
    })

    return () => {
      active = false
    }
  }, [doctor.id, selectedDate, attempt])

  function changeMonth(delta: number) {
    let nextMonth = monthIdx + delta
    let nextYear = year
    if (nextMonth < 0) {
      nextMonth = 11
      nextYear -= 1
    } else if (nextMonth > 11) {
      nextMonth = 0
      nextYear += 1
    }
    setYear(nextYear)
    setMonthIdx(nextMonth)
  }

  function selectDay(day: string) {
    setSelectedDate(day)
    setChosenTime(null)
    setLockError(null)
    setSlotsState({ status: "loading" })
  }

  function handleLock() {
    if (!selectedDate || !chosenTime || isLocking) return
    setLockError(null)

    startLocking(async () => {
      const result = await lockAppointmentSlot(
        patient.id,
        doctor.id,
        `${selectedDate}T${chosenTime}`
      )

      if (result.ok) {
        const expiresAt = Date.parse(result.data.lock_expira_en ?? "")
        onLocked({
          appointment: result.data,
          expiresAt: Number.isNaN(expiresAt) ? Date.now() + 15 * 60_000 : expiresAt,
        })
        return
      }

      setLockError(result.message)
      if (result.code === "SLOT_UNAVAILABLE") {
        // La hora se tomó entre la carga y la confirmación: recargar cupos.
        setChosenTime(null)
        setSlotsState({ status: "loading" })
        setAttempt((n) => n + 1)
      }
    })
  }

  const selectedLabel = selectedDate
    ? new Intl.DateTimeFormat("es-VE", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date(`${selectedDate}T12:00:00`))
    : null

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Paciente: <span className="font-medium text-foreground">{`${patient.nombres} ${patient.apellidos}`}</span>{" "}
          · {doctorNombre(doctor)}
        </p>
        <h2 className="text-xl font-semibold tracking-tight">
          ¿Cuándo te atiendes?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Toca un día del calendario y luego elige la hora disponible.
        </p>
      </header>

      {notice && (
        <Alert variant="warning">
          <Clock className="size-4" />
          <AlertTitle>Bloqueo expirado</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {lockError && (
        <Alert variant="destructive">
          <CircleAlert className="size-4" />
          <AlertTitle>No pudimos bloquear esa hora</AlertTitle>
          <AlertDescription>{lockError}</AlertDescription>
        </Alert>
      )}

      <section
        className="overflow-hidden rounded-2xl border bg-card"
        aria-label="Calendario de citas"
      >
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            disabled={isCurrentMonth}
            aria-label="Mes anterior"
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h3 className="flex items-center gap-2 font-semibold">
            <CalendarDays className="size-4 text-primary" />
            {MESES[monthIdx]} {year}
          </h3>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            aria-label="Mes siguiente"
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 px-3 pb-2 pt-3 text-center">
          {WEEKDAYS.map((day) => (
            <span
              key={day}
              className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {day}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 px-3 pb-3">
          {days.map((cell, index) => {
            if (!cell) return <span key={`blank-${index}`} aria-hidden />
            const disabled = cell.iso < todayISO
            const isSelected = selectedDate === cell.iso

            return (
              <button
                key={cell.iso}
                type="button"
                disabled={disabled}
                onClick={() => selectDay(cell.iso)}
                aria-pressed={isSelected}
                aria-label={cell.iso}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-full text-sm font-medium transition-colors",
                  disabled
                    ? "cursor-not-allowed text-muted-foreground/30"
                    : "hover:bg-muted",
                  isSelected && !disabled && "bg-primary text-primary-foreground hover:bg-primary"
                )}
              >
                {cell.day}
              </button>
            )
          })}
        </div>
      </section>

      {selectedDate && (
        <section className="flex flex-col gap-3" aria-live="polite">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Clock className="size-4 text-primary" />
              {selectedLabel ? selectedLabel.charAt(0).toUpperCase() + selectedLabel.slice(1) : ""}
            </h3>
            {slotsError && (
              <button
                type="button"
                onClick={() => {
                  setSlotsState({ status: "loading" })
                  setAttempt((n) => n + 1)
                }}
                className="flex items-center gap-1 text-xs font-medium text-primary"
              >
                <RefreshCw className="size-3.5" /> Reintentar
              </button>
            )}
          </div>

          {slotsLoading ? (
            <div className="grid grid-cols-3 gap-2" aria-busy="true">
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          ) : slotsError ? (
            <Alert variant="destructive">
              <CircleAlert className="size-4" />
              <AlertTitle>No pudimos cargar las horas</AlertTitle>
              <AlertDescription>{slotsError}</AlertDescription>
            </Alert>
          ) : slots.length === 0 ? (
            <Alert>
              <CalendarDays className="size-4" />
              <AlertTitle>Sin disponibilidad ese día</AlertTitle>
              <AlertDescription>
                El médico no tiene cupos para esta fecha. Prueba con otro día.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => {
                const isSelected = chosenTime === slot.hora
                return (
                  <button
                    key={slot.iso}
                    type="button"
                    onClick={() => {
                      setChosenTime(slot.hora)
                      setLockError(null)
                    }}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex h-11 items-center justify-center rounded-xl border text-sm font-medium transition-all",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.97]",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-card hover:bg-muted/60"
                    )}
                  >
                    {horaAmPm(slot.hora)}
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 backdrop-blur">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {selectedDate && chosenTime
              ? `${selectedLabel} a las ${horaAmPm(chosenTime)}`
              : "Selecciona fecha y hora"}
          </span>
          <Badge variant="outline" className="gap-1.5">
            <Lock className="size-3" /> Bloqueo 15 min
          </Badge>
        </div>
        <Button
          type="button"
          disabled={!selectedDate || !chosenTime || isLocking}
          onClick={handleLock}
          className="h-12 w-full gap-2 rounded-xl text-base"
        >
          {isLocking && <LoaderCircle className="size-4 animate-spin" />}
          {isLocking ? "Verificando disponibilidad…" : "Bloquear hora y continuar al pago"}
          {!isLocking && <Lock className="size-4" />}
        </Button>
        <Separator className="mt-3" />
        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <Lock className="size-3" />
          La hora queda apartada por 15 minutos mientras completas el pago.
        </p>
      </div>
    </div>
  )
}
