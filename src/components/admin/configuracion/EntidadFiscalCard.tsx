"use client"

/**
 * MEDISYS · Entidad fiscal de la clínica (módulo de administración)
 * -----------------------------------------------------------------
 * Formulario de los datos corporativos exigidos por la facturación SENIAT:
 * razón social, RIF, domicilio fiscal, contacto e imprenta de formas libres.
 *
 * Valida en el cliente con `entidadFiscalSchema` (misma regla que la API) y
 * persiste vía `PATCH /api/admin/settings`.
 */
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, CheckCircle2, LoaderCircle, ShieldAlert } from "lucide-react"

import type { CampoIssue, EntidadFiscal } from "@/types/admin"
import {
  entidadFiscalSchema,
  type EntidadFiscalInput,
} from "@/lib/validations/admin"
import { apiGuardarEntidadFiscal } from "@/lib/api-admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type Toast = { tipo: "ok" | "error"; mensaje: string } | null

const VACIO: EntidadFiscalInput = {
  razonSocial: "",
  rif: "",
  domicilioFiscal: "",
  telefonoContacto: "",
  emailFiscal: "",
  imprentaAutorizada: null,
  providenciaFormasLibres: null,
}

function inicial(fiscal: EntidadFiscal | null): EntidadFiscalInput {
  if (!fiscal) return VACIO
  return {
    razonSocial: fiscal.razonSocial ?? "",
    rif: fiscal.rif ?? "",
    domicilioFiscal: fiscal.domicilioFiscal ?? "",
    telefonoContacto: fiscal.telefonoContacto ?? "",
    emailFiscal: fiscal.emailFiscal ?? "",
    imprentaAutorizada: fiscal.imprentaAutorizada,
    providenciaFormasLibres: fiscal.providenciaFormasLibres,
  }
}

export function EntidadFiscalCard({
  clinicSlug,
  fiscal,
  puedeEditar,
}: {
  clinicSlug: string
  fiscal: EntidadFiscal | null
  puedeEditar: boolean
}) {
  const [form, setForm] = useState<EntidadFiscalInput>(() => inicial(fiscal))
  const [issues, setIssues] = useState<CampoIssue[]>([])
  const [toast, setToast] = useState<Toast>(null)
  const [guardando, setGuardando] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(id)
  }, [toast])

  function errorDe(campo: string): string | undefined {
    return issues.find((issue) => issue.campo === campo)?.mensaje
  }

  function cambiar<K extends keyof EntidadFiscalInput>(
    campo: K,
    valor: EntidadFiscalInput[K]
  ) {
    setForm((previo) => ({ ...previo, [campo]: valor }))
  }

  async function guardar() {
    const valido = entidadFiscalSchema.safeParse(form)
    if (!valido.success) {
      setIssues(valido.error.issues)
      setToast({ tipo: "error", mensaje: valido.error.message })
      return
    }

    setIssues([])
    setGuardando(true)
    const respuesta = await apiGuardarEntidadFiscal(clinicSlug, valido.data)
    setGuardando(false)

    if (!respuesta.ok) {
      setIssues(respuesta.issues ?? [])
      setToast({ tipo: "error", mensaje: respuesta.message })
      return
    }

    setForm(inicial(respuesta.data))
    setToast({
      tipo: "ok",
      mensaje:
        "Datos fiscales guardados. Ya están disponibles para la facturación.",
    })
    router.refresh()
  }

  return (
    <section
      aria-labelledby="entidad-fiscal-titulo"
      className="mt-6 flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5"
    >
      <header className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Building2 className="size-5" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 id="entidad-fiscal-titulo" className="font-semibold">
            Datos fiscales de la entidad
          </h2>
          <p className="text-sm text-muted-foreground">
            Con estos datos se emitirán las facturas y notas de crédito ante el
            SENIAT.
          </p>
        </div>
      </header>

      {!puedeEditar && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300">
          <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
          Solo el rol Administrador (o Contador) puede modificar los datos
          fiscales.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Razón social *"
          error={errorDe("razonSocial")}
          ayuda="Tal como aparece en el RIF (ej. IBEARTS, C.A.)."
        >
          <Input
            value={form.razonSocial}
            onChange={(evento) => cambiar("razonSocial", evento.target.value)}
            disabled={!puedeEditar}
            autoComplete="organization"
            placeholder="IBEARTS, C.A."
            aria-invalid={Boolean(errorDe("razonSocial"))}
          />
        </Campo>

        <Campo
          label="RIF *"
          error={errorDe("rif")}
          ayuda="Formato V-00000000-0 (acepta J, E y G)."
        >
          <Input
            value={form.rif}
            onChange={(evento) =>
              cambiar("rif", evento.target.value.toUpperCase())
            }
            disabled={!puedeEditar}
            placeholder="J-40123456-7"
            aria-invalid={Boolean(errorDe("rif"))}
          />
        </Campo>

        <Campo
          label="Domicilio fiscal *"
          error={errorDe("domicilioFiscal")}
          ayuda="Dirección registrada ante el SENIAT."
          className="sm:col-span-2"
        >
          <Input
            value={form.domicilioFiscal}
            onChange={(evento) =>
              cambiar("domicilioFiscal", evento.target.value)
            }
            disabled={!puedeEditar}
            placeholder="Av. Bolívar, Torre Médica, Piso 3, Oficina 302, Caracas"
            aria-invalid={Boolean(errorDe("domicilioFiscal"))}
          />
        </Campo>

        <Campo
          label="Teléfono de contacto *"
          error={errorDe("telefonoContacto")}
          ayuda="Número venezolano (ej. 0212-5551234 o 0414-1234567)."
        >
          <Input
            value={form.telefonoContacto}
            onChange={(evento) =>
              cambiar("telefonoContacto", evento.target.value)
            }
            disabled={!puedeEditar}
            inputMode="tel"
            placeholder="0212-5551234"
            aria-invalid={Boolean(errorDe("telefonoContacto"))}
          />
        </Campo>

        <Campo
          label="Correo fiscal *"
          error={errorDe("emailFiscal")}
          ayuda="Recibe facturas y notas de crédito."
        >
          <Input
            value={form.emailFiscal}
            onChange={(evento) => cambiar("emailFiscal", evento.target.value)}
            disabled={!puedeEditar}
            type="email"
            autoComplete="email"
            placeholder="facturacion@clinica.com.ve"
            aria-invalid={Boolean(errorDe("emailFiscal"))}
          />
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Imprenta autorizada"
          error={errorDe("imprentaAutorizada")}
          ayuda="Opcional. Imprenta autorizada para formas libres."
        >
          <Input
            value={form.imprentaAutorizada ?? ""}
            onChange={(evento) =>
              cambiar("imprentaAutorizada", evento.target.value || null)
            }
            disabled={!puedeEditar}
            placeholder="Imprenta Nacional, C.A."
            aria-invalid={Boolean(errorDe("imprentaAutorizada"))}
          />
        </Campo>

        <Campo
          label="N° de providencia (formas libres)"
          error={errorDe("providenciaFormasLibres")}
          ayuda="Opcional. Providencia que autoriza las formas libres."
        >
          <Input
            value={form.providenciaFormasLibres ?? ""}
            onChange={(evento) =>
              cambiar("providenciaFormasLibres", evento.target.value || null)
            }
            disabled={!puedeEditar}
            placeholder="SNAT/2024/000123"
            aria-invalid={Boolean(errorDe("providenciaFormasLibres"))}
          />
        </Campo>
      </div>

      {puedeEditar && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => void guardar()}
            disabled={guardando}
            className="h-11 gap-2 rounded-xl px-5"
          >
            {guardando && <LoaderCircle className="size-4 animate-spin" />}
            {guardando ? "Guardando…" : "Guardar datos fiscales"}
          </Button>

          {toast && (
            <span
              role="status"
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium",
                toast.tipo === "ok"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              )}
            >
              {toast.tipo === "ok" && (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              )}
              {toast.mensaje}
            </span>
          )}
        </div>
      )}
    </section>
  )
}

function Campo({
  label,
  ayuda,
  error,
  className,
  children,
}: {
  label: string
  ayuda?: string
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {error ? (
        <span className="text-xs font-medium text-destructive">{error}</span>
      ) : (
        ayuda && <span className="text-xs text-muted-foreground">{ayuda}</span>
      )}
    </div>
  )
}
