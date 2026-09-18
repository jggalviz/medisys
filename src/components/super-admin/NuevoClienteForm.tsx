"use client"

/** Formulario de onboarding: crea Auth + tenant + membresía + doctor (Individual). */
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Building2, Check, LoaderCircle, Stethoscope } from "lucide-react"

import { createClientTenant } from "@/app/actions/super-admin-onboarding"
import {
  LIMITE_ESPECIALISTAS_PLAN,
  ajustarMaxEspecialistas,
  nombrePlan,
  precioPlanUSD,
} from "@/lib/suscripcion"
import type { PlanTenant } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/** Precio/cupo comerciales por plan (misma fuente que la landing). */
const PLANES: { id: PlanTenant; detalle: string }[] = [
  {
    id: "INDIVIDUAL",
    detalle: "1 especialista · agendamiento en 3 pasos",
  },
  {
    id: "PYME",
    detalle: "2 a 10 especialistas · 1 sede",
  },
  {
    id: "PRO",
    detalle: "10+ especialistas o múltiples sedes",
  },
]

/** Cupo de especialistas sugerido al elegir cada plan. */
const CUPO_INICIAL: Record<PlanTenant, number> = {
  INDIVIDUAL: LIMITE_ESPECIALISTAS_PLAN.INDIVIDUAL.min,
  PYME: 5,
  PRO: LIMITE_ESPECIALISTAS_PLAN.PRO.min,
}

function slugificar(valor: string): string {
  return valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function NuevoClienteForm() {
  const router = useRouter()
  const [plan, setPlan] = useState<PlanTenant>("PYME")
  const [nombre, setNombre] = useState("")
  const [slug, setSlug] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [telefono, setTelefono] = useState("")
  const [rif, setRif] = useState("")
  const [direccion, setDireccion] = useState("")
  const [maxEspecialistas, setMaxEspecialistas] = useState(
    String(CUPO_INICIAL.PYME)
  )
  const [doctorNombre, setDoctorNombre] = useState("")
  const [especialidad, setEspecialidad] = useState("")
  const [doctorCedula, setDoctorCedula] = useState("")
  const [doctorTelefono, setDoctorTelefono] = useState("")
  const [precioConsulta, setPrecioConsulta] = useState("25")
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function enviar(event: React.FormEvent) {
    event.preventDefault()
    if (isPending) return
    setError(null)
    setExito(null)

    startTransition(async () => {
      const resultado = await createClientTenant({
        plan,
        nombre,
        slug: slug || slugificar(nombre),
        email,
        password,
        telefono,
        rif,
        direccion,
        maxEspecialistas: ajustarMaxEspecialistas(
          plan,
          Number(maxEspecialistas.replace(/\D/g, ""))
        ),
        doctor:
          plan === "INDIVIDUAL"
            ? {
                nombre: doctorNombre,
                especialidad,
                cedula: doctorCedula || null,
                telefono: doctorTelefono || null,
                precioConsulta: Number(precioConsulta.replace(",", ".")) || 0,
              }
            : null,
      })

      if (resultado.ok) {
        setExito(
          `Cliente creado: ${resultado.data.slug} · usuario ${email}. Ya puede iniciar sesión en /${resultado.data.slug}/login`
        )
        router.refresh()
        return
      }
      setError(resultado.message)
    })
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-bold tracking-tight">Nuevo cliente</h1>
        <p className="text-sm text-muted-foreground">
          Alta completa: usuario admin, clínica, membresía y especialista (Plan Individual).
        </p>
      </header>

      {/* Selección de plan */}
      <section className="grid gap-3 sm:grid-cols-3">
        {PLANES.map((opcion) => {
          const activo = plan === opcion.id
          return (
            <button
              key={opcion.id}
              type="button"
              onClick={() => {
                setPlan(opcion.id)
                setMaxEspecialistas(String(CUPO_INICIAL[opcion.id]))
              }}
              aria-pressed={activo}
              className={cn(
                "flex items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-all",
                activo ? "border-primary ring-2 ring-primary/25" : "hover:bg-muted/40"
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {opcion.id === "INDIVIDUAL" ? (
                  <Stethoscope className="size-5" />
                ) : (
                  <Building2 className="size-5" />
                )}
              </span>
              <span className="flex flex-1 flex-col">
                <span className="font-semibold">{nombrePlan(opcion.id)}</span>
                <span className="text-sm font-bold text-teal-700">
                  ${precioPlanUSD(opcion.id)}/mes
                </span>
                <span className="text-xs text-muted-foreground">{opcion.detalle}</span>
              </span>
              {activo && <Check className="size-4 text-primary" />}
            </button>
          )
        })}
      </section>

      {/* Datos de la clínica */}
      <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="nc-nombre">Nombre de la clínica *</Label>
          <Input
            id="nc-nombre"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value)
              setSlug(slugificar(e.target.value))
            }}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nc-slug">Slug (URL) *</Label>
          <Input
            id="nc-slug"
            value={slug}
            onChange={(e) => setSlug(slugificar(e.target.value))}
            className="font-mono"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nc-telefono">Teléfono</Label>
          <Input id="nc-telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nc-rif">RIF</Label>
          <Input id="nc-rif" value={rif} onChange={(e) => setRif(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nc-direccion">Dirección</Label>
          <Input id="nc-direccion" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        </div>
        {plan !== "INDIVIDUAL" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nc-max">Máximo de especialistas</Label>
            <Input
              id="nc-max"
              value={maxEspecialistas}
              onChange={(e) => setMaxEspecialistas(e.target.value)}
              inputMode="numeric"
              placeholder={plan === "PYME" ? "entre 1 y 10" : "mínimo 11"}
            />
          </div>
        )}
      </section>

      {/* Usuario administrador */}
      <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nc-email">Correo del administrador *</Label>
          <Input
            id="nc-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nc-password">Contraseña temporal *</Label>
          <Input
            id="nc-password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="mínimo 6 caracteres"
            required
          />
        </div>
      </section>

      {/* Especialista (solo Plan Individual) */}
      {plan === "INDIVIDUAL" && (
        <section className="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="nc-doctor">Nombre del especialista *</Label>
            <Input
              id="nc-doctor"
              value={doctorNombre}
              onChange={(e) => setDoctorNombre(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nc-especialidad">Especialidad</Label>
            <Input
              id="nc-especialidad"
              value={especialidad}
              onChange={(e) => setEspecialidad(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nc-precio">Precio consulta (USD)</Label>
            <Input
              id="nc-precio"
              value={precioConsulta}
              onChange={(e) => setPrecioConsulta(e.target.value)}
              inputMode="decimal"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nc-cedula">Cédula</Label>
            <Input
              id="nc-cedula"
              value={doctorCedula}
              onChange={(e) => setDoctorCedula(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nc-tel-doctor">Teléfono</Label>
            <Input
              id="nc-tel-doctor"
              value={doctorTelefono}
              onChange={(e) => setDoctorTelefono(e.target.value)}
            />
          </div>
        </section>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {exito && (
        <p className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {exito}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="h-12 gap-2 text-base">
        {isPending && <LoaderCircle className="size-4 animate-spin" />}
        {isPending ? "Creando cliente…" : "Crear cliente y activar"}
      </Button>

    </form>
  )
}
