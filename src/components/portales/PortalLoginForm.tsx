"use client"

/** Formulario de acceso por Cédula + Teléfono (sin contraseña). */
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  KeyRound,
  LoaderCircle,
  ShieldAlert,
  Smartphone,
  UserRound,
} from "lucide-react"

import { loginPortal, getCredencialesDemoPortal } from "@/app/actions/portal-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = {
  tenantId: string
  clinicSlug: string
  rol: "especialista" | "paciente"
  titulo: string
  descripcion: string
  rutaDestino: string
  /** Credenciales DEMO de respaldo (se recargan del tenant al pulsar el botón). */
  datosDemo?: { cedula: string; telefono: string } | null
  /** Muestra el botón "Usar datos DEMO" (por defecto, si hay datos de respaldo). */
  mostrarDemo?: boolean
}

export function PortalLoginForm({
  tenantId,
  clinicSlug,
  rol,
  titulo,
  descripcion,
  rutaDestino,
  datosDemo,
  mostrarDemo,
}: Props) {
  const router = useRouter()
  const [cedula, setCedula] = useState("")
  const [telefono, setTelefono] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [cargandoDemo, setCargandoDemo] = useState(false)
  const [isPending, startTransition] = useTransition()

  /**
   * Autocompleta con el primer especialista/perfil ACTIVO del tenant actual
   * (consulta dinámica). Si falla, usa el respaldo recibido del servidor.
   */
  async function usarDatosDemo() {
    if (cargandoDemo) return
    setError(null)
    setCargandoDemo(true)

    const resultado = await getCredencialesDemoPortal(tenantId, rol)
    setCargandoDemo(false)

    if (resultado.ok) {
      setCedula(resultado.data.cedula)
      setTelefono(resultado.data.telefono)
      return
    }

    if (datosDemo) {
      setCedula(datosDemo.cedula)
      setTelefono(datosDemo.telefono)
      return
    }

    setError(resultado.message)
  }

  function enviar(event: React.FormEvent) {
    event.preventDefault()
    if (isPending) return
    setError(null)

    startTransition(async () => {
      const resultado = await loginPortal(cedula, telefono, rol, tenantId)
      if (resultado.ok) {
        router.push(`/${clinicSlug}${rutaDestino}`)
        router.refresh()
        return
      }
      setError(resultado.message)
    })
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          {rol === "paciente" ? (
            <UserRound className="size-5" aria-hidden="true" />
          ) : (
            <Smartphone className="size-5" aria-hidden="true" />
          )}
        </span>
        <h1 className="text-lg font-bold tracking-tight">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{descripcion}</p>
      </div>

      <form onSubmit={enviar} className="mt-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="portal-cedula">Cédula de Identidad</Label>
          <Input
            id="portal-cedula"
            name="cedula"
            autoComplete="off"
            placeholder="V-12.345.678"
            value={cedula}
            onChange={(e) => setCedula(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="portal-telefono">Teléfono</Label>
          <Input
            id="portal-telefono"
            name="telefono"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0412-1234567"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Debe coincidir con el registrado en la clínica.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        {(mostrarDemo ?? Boolean(datosDemo)) && (
          <Button
            type="button"
            variant="secondary"
            disabled={cargandoDemo}
            onClick={() => void usarDatosDemo()}
            className="gap-2"
          >
            {cargandoDemo ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <KeyRound className="size-4" aria-hidden="true" />
            )}
            {cargandoDemo ? "Cargando datos…" : "Usar datos DEMO"}
          </Button>
        )}

        <Button type="submit" disabled={isPending} className="h-12 gap-2 text-base">
          {isPending && <LoaderCircle className="size-4 animate-spin" />}
          {isPending ? "Verificando…" : "Entrar al portal"}
        </Button>
      </form>
    </div>
  )
}
