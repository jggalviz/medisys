"use client"

/**
 * Paso 3 del wizard: calendario + elección de TURNO (mañana o tarde).
 *
 * - La atención es por orden de llegada dentro del turno, por eso ya no se
 *   elige una hora exacta: solo el turno.
 * - Al confirmar se bloquea la cita 15 minutos (`lockAppointmentSlot`) y se
 *   guarda la hora referencial del turno (08:00 mañana / 13:00 tarde).
 */
import { useMemo, useState, useTransition } from "react"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  LoaderCircle,
  Lock,
} from "lucide-react"

import type { Doctor, Profile } from "@/types/database"
import type { LockCreated, TurnoSeleccionado } from "@/types/booking"
import { lockAppointmentSlot } from "@/app/actions/booking"
import { toISODate } from "@/lib/date"
import { doctorNombre } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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

type TurnoOption = {
  id: TurnoSeleccionado
  icono: string
  titulo: string
  rango: string
}

const TURNOS: readonly TurnoOption[] = [
  {
    id: "manana",
    icono: "🌅",
    titulo: "Turno Mañana",
    rango: "8:00 AM – 12:00 PM",
  },
  {
    id: "tarde",
    icono: "🌇",
    titulo: "Turno Tarde",
    rango: "1:00 PM – 5:00 PM",
  },
]

export function StepDateTimeSelect({ doctor, patient, notice, onLocked }: Props) {
  const today = new Date()
  const todayISO = toISODate(today)

  const [year, setYear] = useState(today.getFullYear())
  const [monthIdx, setMonthIdx] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTurno, setSelectedTurno] = useState<TurnoSeleccionado | null>(
    null
  )
  const [lockError, setLockError] = useState<string | null>(null)
  const [isLocking, startLocking] = useTransition()

  const days = useMemo(() => buildMonthDays(year, monthIdx), [year, monthIdx])

  const isCurrentMonth =
    year === today.getFullYear() && monthIdx === today.getMonth()

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
    setSelectedTurno(null)
    setLockError(null)
  }

  function handleLock() {
    if (!selectedDate || !selectedTurno || isLocking) return
    setLockError(null)

    startLocking(async () => {
      const result = await lockAppointmentSlot({
        patientId: patient.id,
        doctorId: doctor.id,
        date: selectedDate,
        turno: selectedTurno,
      })

      if (result.ok) {
        const expiresAt = Date.parse(result.data.lock_expira_en ?? "")
        onLocked({
          appointment: result.data,
          expiresAt: Number.isNaN(expiresAt)
            ? Date.now() + 15 * 60_000
            : expiresAt,
        })
        return
      }

      setLockError(result.message)
      if (result.code === "SLOT_UNAVAILABLE") {
        setSelectedTurno(null)
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

  const turnoSeleccionado =
    TURNOS.find((turno) => turno.id === selectedTurno) ?? null

    return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Paciente:{" "}
          <span className="font-medium text-foreground">
            {`${patient.nombres} ${patient.apellidos}`}
          </span>{" "}
          · {doctorNombre(doctor)}
        </p>
        <h2 className="text-xl font-semibold tracking-tight">
          ¿Cuándo y en qué turno te atiendes?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Elige el día y luego el turno (mañana o tarde).
        </p>
      </header>

      <div
        role="note"
        aria-label="Nota importante sobre la recepción"
        className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200"
      >
        <span className="shrink-0 text-base leading-5" aria-hidden="true">
          📌
        </span>
        <p className="leading-6">
          <strong>Nota importante:</strong> La atención es por orden de
          llegada. Al llegar a la clínica, dirígete a recepción para confirmar
          tu llegada, validar tu turno y realizar el pago si no lo completaste
          en línea.
        </p>
      </div>

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
          <AlertTitle>No pudimos bloquear el turno</AlertTitle>
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
                  isSelected &&
                    !disabled &&
                    "bg-primary text-primary-foreground hover:bg-primary"
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
              {selectedLabel
                ? selectedLabel.charAt(0).toUpperCase() + selectedLabel.slice(1)
                : ""}
            </h3>
          </div>

          <p className="text-sm text-muted-foreground">
            Elige el turno que prefieras. La atención dentro del turno es por
            orden de llegada.
          </p>

          <div
            role="radiogroup"
            aria-label="Turnos disponibles"
            className="grid gap-2 sm:grid-cols-2"
          >
            {TURNOS.map((turno) => {
              const isSelected = selectedTurno === turno.id
              return (
                <button
                  key={turno.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setSelectedTurno(turno.id)
                    setLockError(null)
                  }}
                  className={cn(
                    "flex w-full flex-col items-start gap-1.5 rounded-2xl border bg-card p-4 text-left transition-all",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.99]",
                    isSelected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "border-border hover:bg-muted/40"
                  )}
                >
                  <span className="text-2xl leading-none" aria-hidden="true">
                    {turno.icono}
                  </span>
                  <span className="font-semibold">{turno.titulo}</span>
                  <span className="text-sm font-medium text-muted-foreground">
                    {turno.rango}
                  </span>
                </button>
              )
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            Atención por orden de llegada durante el turno seleccionado.
          </p>
        </section>
      )}

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 backdrop-blur">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {selectedDate && turnoSeleccionado
              ? `${turnoSeleccionado.titulo} · ${
                  selectedLabel ? selectedLabel.charAt(0).toUpperCase() + selectedLabel.slice(1) : ""
                }`
              : "Selecciona fecha y turno"}
          </span>
          <Badge variant="outline" className="gap-1.5">
            <Lock className="size-3" /> Bloqueo 15 min
          </Badge>
        </div>
        <Button
          type="button"
          disabled={!selectedDate || !selectedTurno || isLocking}
          onClick={handleLock}
          className="h-12 w-full gap-2 rounded-xl text-base"
        >
          {isLocking && <LoaderCircle className="size-4 animate-spin" />}
          {isLocking
            ? "Bloqueando turno…"
            : "Bloquear turno y continuar al pago 🔒"}
        </Button>
        <Separator className="mt-3" />
        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <Lock className="size-3" />
          Tu turno queda apartado por 15 minutos mientras completas el pago.
        </p>
      </div>
    </div>
  )
}