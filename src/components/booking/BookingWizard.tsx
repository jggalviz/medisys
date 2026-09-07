"use client"

/**
 * MEDISYS · Booking Wizard (contenedor del flujo paso a paso)
 * -----------------------------------------------------------
 * Estado global del flujo:
 *   Paso 1 → Paciente      (StepPatientSelect)
 *   Paso 2 → Especialidad (StepDoctorSelect)
 *   Paso 3 → Fecha y hora  (StepDateTimeSelect · crea el LOCK de 15 min)
 *   Paso 4 → Pago          (StepPayment · comprobante)
 *   Vista  → Éxito         (confirmación tras registrar el pago)
 *
 * El wizard coordina el temporizador del lock: al vencer los 15 minutos
 * libera la cita (Server Action `releaseLockedSlot`), regresa al paso 3
 * y muestra una alerta para elegir una nueva hora.
 */
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Check, LoaderCircle, TimerReset } from "lucide-react"

import type { Appointment, Doctor, Profile, Tenant } from "@/types/database"
import type { LockCreated } from "@/types/booking"
import { releaseLockedSlot } from "@/app/actions/booking"
import { StepPatientSelect } from "./StepPatientSelect"
import { StepDoctorSelect } from "./StepDoctorSelect"
import { StepDateTimeSelect } from "./StepDateTimeSelect"
import { StepPayment } from "./StepPayment"
import { cn } from "@/lib/utils"

type Props = {
  tenant: Tenant
}

const PASOS = ["Paciente", "Especialidad", "Fecha y hora", "Pago"] as const
type StepIndex = 1 | 2 | 3 | 4

function formatoRestante(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const min = Math.floor(total / 60)
  const sec = total % 60
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

export function BookingWizard({ tenant }: Props) {
  const [step, setStep] = useState<StepIndex>(1)
  const [patient, setPatient] = useState<Profile | null>(null)
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [lock, setLock] = useState<LockCreated | null>(null)
  const [done, setDone] = useState<Appointment | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [notice, setNotice] = useState<string | null>(null)
  const [releasing, setReleasing] = useState(false)

  const remainingMs = useMemo(() => {
    if (!lock) return 0
    return lock.expiresAt - now
  }, [lock, now])

  const pasoActual = useMemo(() => PASOS[step - 1], [step])

  // Tic del temporizador sólo mientras exista un lock activo.
  useEffect(() => {
    if (!lock || done) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [lock, done])

  // El lock venció → liberar cupo y volver al paso 3.
  useEffect(() => {
    if (!lock || done || remainingMs > 0) return

    const liberar = async () => {
      setReleasing(true)
      setLock(null)
      setNotice(
        "Tu cupo estuvo apartado 15 minutos y expiró por falta de pago. Elige otra hora."
      )
      setStep(3)
      await releaseLockedSlot(lock.appointment.id)
      setReleasing(false)
    }
    void liberar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs, done])

  async function goBack() {
    if (step === 1) return

    if (step === 4 && lock) {
      // El usuario decide editar fecha/especialidad/paciente: liberar el lock.
      setLock(null)
      await releaseLockedSlot(lock.appointment.id)
    }
    setNotice(null)
    setStep((prev) => (prev - 1) as StepIndex)
  }

  async function goToStep(target: StepIndex) {
    if (target >= step) return // sólo se permite retroceder

    if (step === 4 && target < 4 && lock) {
      setLock(null)
      await releaseLockedSlot(lock.appointment.id)
    }
    setNotice(null)
    setStep(target)
  }

  function handleLocked(newLock: LockCreated) {
    setNotice(null)
    setLock(newLock)
    setNow(newLock.expiresAt)
    setStep(4)
  }

  function handlePaid(appointment: Appointment) {
    setDone(appointment)
    setLock(null)
  }

  function resetWizard() {
    setPatient(null)
    setDoctor(null)
    setLock(null)
    setDone(null)
    setNotice(null)
    setStep(1)
  }

  const locked = Boolean(lock)
  const lockDanger = locked && remainingMs < 120_000

  if (done) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
          <Check className="size-10" strokeWidth={2.5} />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold tracking-tight">¡Casi listo!</h2>
          <p className="text-muted-foreground">
            Registramos tu pago con la referencia{" "}
            <strong className="text-foreground">{done.pago_referencia}</strong>.
            La clínica validará el comprobante y te confirmará la cita.
          </p>
        </div>

        <dl className="w-full rounded-2xl border bg-card p-4 text-left">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Código de reserva
          </dt>
          <dd className="mt-0.5 font-mono text-lg font-bold text-primary">
            {done.id.slice(0, 8).toUpperCase()}
          </dd>
          {doctor && (
            <>
              <dt className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Especialista
              </dt>
              <dd className="text-sm font-medium">{`${doctor.nombres} ${doctor.apellidos}`}</dd>
            </>
          )}
          {patient && (
            <>
              <dt className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Paciente
              </dt>
              <dd className="text-sm font-medium">{`${patient.nombres} ${patient.apellidos}`}</dd>
            </>
          )}
        </dl>

        <div className="w-full">
          <button
            type="button"
            onClick={resetWizard}
            className="h-12 w-full rounded-xl border border-border bg-background text-base font-medium hover:bg-muted/40"
          >
            Reservar otra cita
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center gap-3 px-4 py-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => void goBack()}
              aria-label="Paso anterior"
              className="flex size-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted active:scale-95"
            >
              <ArrowLeft className="size-5" />
            </button>
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
              {tenant.nombre.charAt(0).toUpperCase()}
            </span>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {tenant.nombre} · Reserva
            </span>
            <span className="truncate font-semibold">
              {step === 4 ? "Pago y confirmación" : `Paso ${step} de 4 · ${pasoActual}`}
            </span>
          </div>

          {locked && (
            <span
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums",
                lockDanger
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  : "border-border bg-card text-muted-foreground"
              )}
              aria-label="Tiempo restante del bloqueo"
            >
              {releasing ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <TimerReset className={cn("size-3.5", lockDanger && "animate-pulse")} />
              )}
              {formatoRestante(remainingMs)}
            </span>
          )}
        </div>

        <nav
          aria-label="Progreso de la reserva"
          className="mx-auto flex w-full max-w-md items-center justify-center gap-1 px-4 pb-3"
        >
          {PASOS.map((label, index) => {
            const n = (index + 1) as StepIndex
            const activo = step === n
            const completado = step > n
            const alcanzable = n < step

            return (
              <button
                key={label}
                type="button"
                disabled={!alcanzable}
                onClick={() => void goToStep(n)}
                aria-current={activo ? "step" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1",
                  !alcanzable && "cursor-default"
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors",
                    activo && "bg-primary text-primary-foreground",
                    completado && "bg-emerald-500/15 text-emerald-600",
                    !activo && !completado && "bg-muted text-muted-foreground/60",
                    alcanzable && !activo && "cursor-pointer hover:ring-2 hover:ring-ring/40"
                  )}
                >
                  {completado ? <Check className="size-3.5" /> : n}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    activo ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </button>
            )
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-5">
        {step === 1 && (
          <StepPatientSelect
            clinicSlug={tenant.slug}
            selectedPatient={patient}
            onContinue={(next) => {
              setPatient(next)
              setStep(2)
            }}
          />
        )}

        {step === 2 && (
          <StepDoctorSelect
            clinicSlug={tenant.slug}
            selectedDoctor={doctor}
            onContinue={(next) => {
              setDoctor(next)
              setNotice(null)
              setStep(3)
            }}
          />
        )}

        {step === 3 && doctor && patient && (
          <StepDateTimeSelect
            doctor={doctor}
            patient={patient}
            notice={notice}
            onLocked={handleLocked}
          />
        )}

        {step === 4 && doctor && patient && lock && (
          <StepPayment
            tenant={tenant}
            patient={patient}
            doctor={doctor}
            appointment={lock.appointment}
            lockRemainingMs={remainingMs}
            onSuccess={handlePaid}
            onLockExpired={() => void goBack()}
          />
        )}
      </main>
    </div>
  )
}
