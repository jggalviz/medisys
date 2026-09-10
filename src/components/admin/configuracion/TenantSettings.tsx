"use client"

/**
 * Vista de configuración del tenant (admin).
 * Tabs: Información General · Pago Móvil · Branding · Capacidad.
 * Persiste con `updateTenantSettings` y sube el logo con `uploadTenantLogo`.
 */
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, ImageUp, LoaderCircle, ShieldAlert } from "lucide-react"

import type { CuentaCobro, Tenant } from "@/types/database"
import type { TenantSettingsData } from "@/types/admin"
import {
  updateTenantSettings,
  uploadTenantLogo,
} from "@/app/actions/tenant"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { logoMostrable } from "@/lib/branding"
import { cn } from "@/lib/utils"

type TabId = "general" | "pago" | "branding" | "capacidad"

type Toast = { tipo: "ok" | "error"; mensaje: string } | null

const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "Información General" },
  { id: "pago", label: "Pago Móvil" },
  { id: "branding", label: "Branding" },
  { id: "capacidad", label: "Capacidad" },
]

function inicialDatos(tenant: Tenant): TenantSettingsData {
  const cuentas =
    tenant.datos_pago_movil?.cuentas?.map((cuenta) => ({ ...cuenta })) ?? []
  return {
    nombre: tenant.nombre ?? "",
    rif: tenant.rif ?? "",
    direccion: tenant.direccion ?? "",
    telefono: tenant.telefono ?? "",
    pago_movil_enabled: tenant.pago_movil_enabled ?? true,
    max_slots_per_shift: tenant.max_slots_per_shift ?? null,
    datos_pago_movil: {
      cuentas,
      instrucciones: tenant.datos_pago_movil?.instrucciones ?? "",
    },
  }
}

export function TenantSettings({ tenant }: { tenant: Tenant }) {
  const [tab, setTab] = useState<TabId>("general")
  const [form, setForm] = useState<TenantSettingsData>(() =>
    inicialDatos(tenant)
  )
  const [logoUrl, setLogoUrl] = useState<string | null>(logoMostrable(tenant.logo_url))
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)
  const [isSaving, startSaving] = useTransition()
  const [isUploading, startUploading] = useTransition()
  const router = useRouter()

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(id)
  }, [toast])

  useEffect(() => {
    return () => {
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl)
    }
  }, [previewObjectUrl])

  const cuentas = form.datos_pago_movil?.cuentas ?? []

  function patch(payload: Partial<TenantSettingsData>) {
    setForm((prev) => ({ ...prev, ...payload }))
  }

  function updateCuenta(index: number, patchCuenta: Partial<CuentaCobro>) {
    setForm((prev) => {
      const lista = (prev.datos_pago_movil?.cuentas ?? []).map((c, i) =>
        i === index ? { ...c, ...patchCuenta } : c
      )
      return {
        ...prev,
        datos_pago_movil: {
          cuentas: lista,
          instrucciones: prev.datos_pago_movil?.instrucciones ?? "",
        },
      }
    })
  }

  function agregarCuenta() {
    const nueva: CuentaCobro = {
      metodo: "pago_movil",
      banco: "",
      titular: "",
      cedula_rif: "",
      telefono: "",
      correo_zelle: null,
    }
    setForm((prev) => ({
      ...prev,
      datos_pago_movil: {
        cuentas: [...cuentas, nueva],
        instrucciones: prev.datos_pago_movil?.instrucciones ?? "",
      },
    }))
  }

  function quitarCuenta(index: number) {
    setForm((prev) => {
      const lista = (prev.datos_pago_movil?.cuentas ?? []).filter(
        (_, i) => i !== index
      )
      return {
        ...prev,
        datos_pago_movil: {
          cuentas: lista,
          instrucciones: prev.datos_pago_movil?.instrucciones ?? "",
        },
      }
    })
  }

  function guardarCambios() {
    if (isSaving) return
    startSaving(async () => {
      const resultado = await updateTenantSettings({
        tenantId: tenant.id,
        clinicSlug: tenant.slug || "clinica-demo",
        data: form,
      })
      if (resultado.ok) {
        // Actualiza el estado local con la respuesta fresca de la BD (la
        // acción devuelve el tenant persistido). Así el formulario no se
        // revierte por re-renders internos con la prop antigua.
        const tenantActualizado = resultado.data.tenant
        setForm(inicialDatos(tenantActualizado))
        setLogoUrl(logoMostrable(tenantActualizado.logo_url))
        // Obliga a re-ejecutar el Server Component para refrescar la prop.
        router.refresh()
        setToast({ tipo: "ok", mensaje: "Configuración guardada ✓" })
      } else {
        setToast({ tipo: "error", mensaje: resultado.message })
      }
    })
  }

  function elegirLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    event.target.value = ""
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl)
    setPreviewObjectUrl(null)
    if (file) {
      if (!file.type.startsWith("image/")) {
        setToast({ tipo: "error", mensaje: "Selecciona un archivo de imagen." })
        return
      }
      setLogoFile(file)
      setPreviewObjectUrl(URL.createObjectURL(file))
    }
  }

  function subirLogo() {
    if (!logoFile || isUploading) return
    startUploading(async () => {
      const formData = new FormData()
      formData.append("logo", logoFile)
      const resultado = await uploadTenantLogo(tenant.id, formData)
      if (resultado.ok) {
        setLogoUrl(resultado.data.logoUrl)
        setLogoFile(null)
        // Re-ejecuta el Server Component para persistir logo_url en la prop.
        router.refresh()
        setToast({ tipo: "ok", mensaje: "Logo actualizado ✓" })
      } else {
        setToast({ tipo: "error", mensaje: resultado.message })
      }
    })
  }

  const previewSrc = previewObjectUrl ?? logoUrl

    return (
    <div className="mt-6 flex flex-col gap-5">
      {/* Pestañas */}
      <nav
        aria-label="Secciones de configuración"
        className="flex flex-wrap gap-1.5"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === item.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted/60"
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={cn(
            "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm",
            toast.tipo === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          {toast.tipo === "ok" ? (
            <CheckCircle2 className="size-4 shrink-0" />
          ) : (
            <ShieldAlert className="size-4 shrink-0" />
          )}
          {toast.mensaje}
        </div>
      )}

            {tab === "general" && (
        <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">Información General</h2>
          <Campo label="Nombre de la clínica *">
            <Input
              value={form.nombre}
              onChange={(e) => patch({ nombre: e.target.value })}
              required
            />
          </Campo>
          <Campo label="RIF">
            <Input
              value={form.rif ?? ""}
              placeholder="J-00000000-0"
              onChange={(e) => patch({ rif: e.target.value })}
            />
          </Campo>
          <Campo label="Dirección física">
            <Input
              value={form.direccion ?? ""}
              placeholder="Av. …, consultorio …"
              onChange={(e) => patch({ direccion: e.target.value })}
            />
          </Campo>
          <Campo label="Teléfono institucional">
            <Input
              value={form.telefono ?? ""}
              placeholder="0212-000.00.00"
              onChange={(e) => patch({ telefono: e.target.value })}
            />
          </Campo>
        </section>
      )}

            {tab === "pago" && (
        <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold">Pasarela de Pago Móvil</h2>
              <p className="text-sm text-muted-foreground">
                Si está pausada, el wizard público ofrecerá solo «Pagar en
                Recepción».
              </p>
            </div>
            <Switch
              activo={form.pago_movil_enabled}
              onToggle={(valor) => patch({ pago_movil_enabled: valor })}
              etiqueta="Pasarela activa"
            />
          </div>

          <Campo label="Instrucciones para el paciente (opcional)">
            <textarea
              value={form.datos_pago_movil?.instrucciones ?? ""}
              rows={3}
              onChange={(e) =>
                patch({
                  datos_pago_movil: {
                    cuentas,
                    instrucciones: e.target.value,
                  },
                })
              }
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            />
          </Campo>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Cuentas Pago Móvil</h3>
            {cuentas.map((cuenta, index) => (
              <fieldset
                key={`${cuenta.banco ?? "cuenta"}-${index}`}
                className="flex flex-col gap-2 rounded-xl border p-3"
              >
                <legend className="px-1 text-xs text-muted-foreground">
                  Cuenta {index + 1}
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Campo label="Banco">
                    <Input
                      value={cuenta.banco ?? ""}
                      onChange={(e) =>
                        updateCuenta(index, { banco: e.target.value })
                      }
                    />
                  </Campo>
                  <Campo label="Titular">
                    <Input
                      value={cuenta.titular}
                      onChange={(e) =>
                        updateCuenta(index, { titular: e.target.value })
                      }
                    />
                  </Campo>
                  <Campo label="Cédula / RIF">
                    <Input
                      value={cuenta.cedula_rif ?? ""}
                      onChange={(e) =>
                        updateCuenta(index, { cedula_rif: e.target.value })
                      }
                    />
                  </Campo>
                  <Campo label="Teléfono">
                    <Input
                      value={cuenta.telefono ?? ""}
                      inputMode="tel"
                      onChange={(e) =>
                        updateCuenta(index, { telefono: e.target.value })
                      }
                    />
                  </Campo>
                </div>
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 text-destructive"
                    onClick={() => quitarCuenta(index)}
                  >
                    Eliminar cuenta
                  </Button>
                </div>
              </fieldset>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={agregarCuenta}
              className="w-fit"
            >
              + Agregar cuenta
            </Button>
          </div>
        </section>
      )}

            {tab === "branding" && (
        <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
          <div>
            <h2 className="font-semibold">Logo oficial de la clínica</h2>
            <p className="text-sm text-muted-foreground">
              Se muestra en el wizard de reserva, recibos y confirmaciones.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- Logo del tenant
              <img
                src={previewSrc}
                alt="Logo actual"
                className="size-20 rounded-2xl border object-cover"
              />
            ) : (
              <span className="flex size-20 items-center justify-center rounded-2xl border bg-muted text-3xl font-bold text-muted-foreground">
                {tenant.nombre.slice(0, 2).toUpperCase()}
              </span>
            )}
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted/50">
              <ImageUp className="size-4" />
              Elegir imagen
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="sr-only"
                onChange={elegirLogo}
              />
            </label>
          </div>

          {logoFile && (
            <p className="text-xs text-muted-foreground">
              Archivo: {logoFile.name} · presiona «Subir logo» para guardarlo.
            </p>
          )}

          <div>
            <Button
              type="button"
              disabled={!logoFile || isUploading}
              onClick={subirLogo}
              className="gap-2"
            >
              {isUploading && <LoaderCircle className="size-4 animate-spin" />}
              {isUploading ? "Subiendo logo…" : "Subir logo"}
            </Button>
          </div>
        </section>
      )}

      {tab === "capacidad" && (
        <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold">Cupos por turno</h2>
            <p className="text-sm text-muted-foreground">
              Deja vacío o en 0 para reservas ilimitadas por turno. Al definir
              un límite, el wizard dejará de aceptar reservas cuando se alcance.
            </p>
          </div>
          <Campo label="Máximo de reservas por turno (mañana/tarde)">
            <Input
              inputMode="numeric"
              value={form.max_slots_per_shift ? String(form.max_slots_per_shift) : ""}
              placeholder="0 = ilimitado"
              onChange={(e) => {
                const valor = Number(e.target.value)
                patch({
                  max_slots_per_shift:
                    e.target.value === "" ? null : Number.isFinite(valor) ? Math.max(1, Math.floor(valor)) : null,
                })
              }}
            />
          </Campo>
        </section>
      )}

      {/* Guardar cambios */}
      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <Button
          type="button"
          onClick={guardarCambios}
          disabled={isSaving || isUploading}
          className="h-12 w-full gap-2 rounded-xl text-base"
        >
          {isSaving && <LoaderCircle className="size-4 animate-spin" />}
          {isSaving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  )
}

function Campo({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  )
}

function Switch({
  activo,
  onToggle,
  etiqueta,
}: {
  activo: boolean
  onToggle: (valor: boolean) => void
  etiqueta: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={() => onToggle(!activo)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
        activo ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
      )}
    >
      <span
        className={cn(
          "inline-block size-5 rounded-full bg-white shadow transition-transform",
          activo ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  )
}