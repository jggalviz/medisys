"use client"

/**
 * Paso 1 del wizard: selección del paciente.
 *
 * - Si hay sesión: lista los pacientes del tenant (titular + familiares).
 * - Invitados o cuentas sin pacientes: formulario de carga rápida.
 * - Al guardar un paciente nuevo se continúa automáticamente al paso 2.
 */
import { useEffect, useState, useTransition } from "react"
import { Baby, BadgeCheck, ChevronRight, LoaderCircle, Plus, UserRound, Users } from "lucide-react"

import type { Profile } from "@/types/database"
import { createPatientForBooking, getPatientOptions } from "@/app/actions/booking"
import { perfilNombre, iniciales } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type PatientOption = {
  profile: Profile
  isTitular: boolean
}

type PatientLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ok"
      isAuthenticated: boolean
      patients: PatientOption[]
    }

type Props = {
  clinicSlug: string
  onContinue: (patient: Profile) => void
}

function PatientCard({
  patient,
  selected,
  onSelect,
}: {
  patient: PatientOption
  selected: boolean
  onSelect: () => void
}) {
  const { profile } = patient

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border bg-card p-3.5 text-left transition-all",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.99]",
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
          : "border-border hover:bg-muted/40"
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
        aria-hidden
      >
        {iniciales(profile.nombres, profile.apellidos)}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="truncate font-semibold">{perfilNombre(profile)}</span>
          {patient.isTitular && (
            <Badge variant="success" className="gap-1">
              <BadgeCheck className="size-3" /> Titular
            </Badge>
          )}
          {profile.es_menor && (
            <Badge variant="secondary" className="gap-1">
              <Baby className="size-3" /> Menor de edad
            </Badge>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {profile.cedula ? `C.I. ${profile.cedula}` : "Sin cédula registrada"}
          {profile.parentesco ? ` · ${profile.parentesco}` : ""}
        </span>
      </span>

      <ChevronRight
        className={cn(
          "size-5 shrink-0 transition-transform",
          selected ? "translate-x-0.5 text-primary" : "text-muted-foreground/50"
        )}
      />
    </button>
  )
}

/**
 * Formulario exprés para registrar un paciente nuevo
 * (familiar, menor de edad o invitado sin cuenta).
 */
function QuickPatientForm({
  clinicSlug,
  onSaved,
}: {
  clinicSlug: string
  onSaved: (patient: Profile) => void
}) {
  const [nombres, setNombres] = useState("")
  const [apellidos, setApellidos] = useState("")
  const [cedula, setCedula] = useState("")
  const [telefono, setTelefono] = useState("")
  const [parentesco, setParentesco] = useState("")
  const [fechaNacimiento, setFechaNacimiento] = useState("")
  const [esMenor, setEsMenor] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const valid = nombres.trim().length > 1 && apellidos.trim().length > 1

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid || isPending) return

    setError(null)
    startTransition(async () => {
      const result = await createPatientForBooking(clinicSlug, {
        nombres,
        apellidos,
        cedula: cedula.trim() || null,
        telefono: telefono.trim() || null,
        fecha_nacimiento: esMenor && fechaNacimiento ? fechaNacimiento : null,
        es_menor: esMenor,
        parentesco: parentesco.trim() || null,
      })

      if (result.ok) {
        onSaved(result.data)
      } else {
        setError(result.message)
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border bg-card p-4 focus-within:border-primary/40"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
          <Label htmlFor="paciente-nombres">Nombres *</Label>
          <Input
            id="paciente-nombres"
            name="nombres"
            autoComplete="given-name"
            placeholder="María José"
            value={nombres}
            onChange={(e) => setNombres(e.target.value)}
            required
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
          <Label htmlFor="paciente-apellidos">Apellidos *</Label>
          <Input
            id="paciente-apellidos"
            name="apellidos"
            autoComplete="family-name"
            placeholder="Rivas"
            value={apellidos}
            onChange={(e) => setApellidos(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="paciente-cedula">Cédula</Label>
          <Input
            id="paciente-cedula"
            name="cedula"
            inputMode="numeric"
            autoComplete="off"
            placeholder="V-12.345.678"
            value={cedula}
            onChange={(e) => setCedula(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="paciente-telefono">Teléfono</Label>
          <Input
            id="paciente-telefono"
            name="telefono"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0412-123.45.67"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
          <Label htmlFor="paciente-parentesco">Parentesco</Label>
          <Input
            id="paciente-parentesco"
            name="parentesco"
            autoComplete="off"
            placeholder="Ej. hijo/a, esposa, madre…"
            value={parentesco}
            onChange={(e) => setParentesco(e.target.value)}
          />
        </div>
        <div className="col-span-2 flex items-center gap-2 pt-1 sm:col-span-1">
          <input
            id="paciente-es-menor"
            type="checkbox"
            checked={esMenor}
            onChange={(e) => setEsMenor(e.target.checked)}
            className="size-4.5 shrink-0 rounded border-border accent-primary"
          />
          <Label htmlFor="paciente-es-menor" className="cursor-pointer">
            Es menor de edad
          </Label>
        </div>
      </div>

      {esMenor && (
        <div className="mt-3 flex flex-col gap-1.5">
          <Label htmlFor="paciente-fecha-nacimiento">
            Fecha de nacimiento (para el carnet del menor)
          </Label>
          <Input
            id="paciente-fecha-nacimiento"
            name="fecha_nacimiento"
            type="date"
            value={fechaNacimiento}
            onChange={(e) => setFechaNacimiento(e.target.value)}
          />
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertTitle>No se pudo registrar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={!valid || isPending}
        className="mt-4 h-12 w-full gap-2 rounded-xl text-base"
      >
        {isPending && <LoaderCircle className="size-4 animate-spin" />}
        {isPending ? "Guardando paciente…" : "Guardar y continuar"}
        {!isPending && <ChevronRight className="size-4" />}
      </Button>
    </form>
  )
}

export function StepPatientSelect({
  clinicSlug,
  selectedPatient,
  onContinue,
}: Props & { selectedPatient?: Profile | null }) {
  const [attempt, setAttempt] = useState(0)
  const [load, setLoad] = useState<PatientLoadState>({ status: "loading" })
  const [selected, setSelected] = useState<Profile | null>(selectedPatient ?? null)
  const [showQuick, setShowQuick] = useState(false)

  // Carga inicial (y reintentos): sólo se hace setState dentro del callback.
  useEffect(() => {
    let active = true

    getPatientOptions(clinicSlug).then((result) => {
      if (!active) return
      if (result.ok) {
        setLoad({
          status: "ok",
          isAuthenticated: result.data.session.isAuthenticated,
          patients: result.data.profiles.map((profile) => ({
            profile,
            isTitular: profile.es_titular,
          })),
        })
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
  const isAuthenticated = load.status === "ok" ? load.isAuthenticated : false
  const patients = load.status === "ok" ? load.patients : []

  function handleSaved(patient: Profile) {
    onContinue(patient)
  }

  const hasPatients = patients.length > 0

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">
          ¿Para quién es la cita?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Elige un paciente registrado o agrega un familiar/menor de edad.
        </p>
      </header>

      {loading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-[76px] w-full" />
          <Skeleton className="h-[76px] w-full" />
        </div>
      ) : loadError ? (
        <div className="flex flex-col gap-3">
          <Alert variant="destructive">
            <AlertTitle>No pudimos cargar tus pacientes</AlertTitle>
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
      ) : (
        <>
          {hasPatients && (
            <section className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="size-4" /> Pacientes
              </h3>
              <div className="flex flex-col gap-2">
                {patients.map((item) => (
                  <PatientCard
                    key={item.profile.id}
                    patient={item}
                    selected={selected?.id === item.profile.id}
                    onSelect={() => {
                      setSelected(item.profile)
                      setShowQuick(false)
                    }}
                  />
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowQuick((v) => !v)}
                className="mt-1 h-11 w-full gap-2 rounded-xl text-sm"
              >
                <Plus className="size-4" />
                {showQuick ? "Cerrar formulario" : "Registrar familiar o menor de edad"}
              </Button>
            </section>
          )}

          {!hasPatients && !showQuick && (
            <section className="flex flex-col gap-3 rounded-2xl border border-dashed bg-card p-4">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRound className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold">
                  {isAuthenticated ? "Aún no tienes pacientes registrados" : "Parece tu primera visita"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isAuthenticated
                    ? "Registra tu perfil de titular en un minuto y luego podrás añadir familiares."
                    : "Registra rápidamente al paciente (puedes ser tú o un menor a tu cargo)."}
                </p>
              </div>
              <Button type="button" onClick={() => setShowQuick(true)} className="h-12 w-full rounded-xl">
                Registrar paciente
              </Button>
            </section>
          )}

          {showQuick && <QuickPatientForm clinicSlug={clinicSlug} onSaved={handleSaved} />}

          {hasPatients && !showQuick && (
            <Separator className="my-1" />
          )}
        </>
      )}

      {hasPatients && !showQuick && (
        <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 backdrop-blur">
          <Button
            type="button"
            disabled={!selected}
            onClick={() => selected && onContinue(selected)}
            className="h-12 w-full gap-2 rounded-xl text-base"
          >
            Continuar
            <ChevronRight className="size-4" />
          </Button>
          {!selected && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Selecciona un paciente para continuar
            </p>
          )}
        </div>
      )}
    </div>
  )
}
