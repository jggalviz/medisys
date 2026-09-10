"use client"

/**
 * Editor de la Landing Page del tenant (/admin/landing).
 * Switch de publicación + campos preestablecidos + servicios destacados.
 */
import { useState } from "react"
import { ExternalLink, LoaderCircle, Plus, Save, Trash2 } from "lucide-react"

import { updateTenantLandingConfig } from "@/app/actions/landing"
import type { LandingConfig, LandingServicio } from "@/types/database"
import { LANDING_LIMITES } from "@/lib/landing"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type Props = {
  tenantId: string
  clinicSlug: string
  nombre: string
  inicial: { enabled: boolean; config: LandingConfig }
}

type Feedback = { tipo: "ok" | "error"; mensaje: string } | null

export function LandingManager({ tenantId, clinicSlug, nombre, inicial }: Props) {
  const [enabled, setEnabled] = useState(inicial.enabled)
  const [config, setConfig] = useState<LandingConfig>(inicial.config)
  const [servicios, setServicios] = useState<LandingServicio[]>(inicial.config.servicios)
  const [guardando, setGuardando] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  function patch(parcial: Partial<LandingConfig>) {
    setConfig((prev) => ({ ...prev, ...parcial }))
  }

  function actualizarServicio(index: number, parcial: Partial<LandingServicio>) {
    setServicios((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...parcial } : s))
    )
  }

  function agregarServicio() {
    if (servicios.length >= LANDING_LIMITES.servicios) return
    setServicios((prev) => [...prev, { titulo: "", descripcion: "" }])
  }

  function quitarServicio(index: number) {
    setServicios((prev) => prev.filter((_, i) => i !== index))
  }

  async function guardar(event: React.FormEvent) {
    event.preventDefault()
    if (guardando) return
    setGuardando(true)
    setFeedback(null)

    const resultado = await updateTenantLandingConfig({
      tenantId,
      enabled,
      config: {
        ...config,
        servicios: servicios.filter((s) => s.titulo.trim().length > 0),
      },
    })

    setGuardando(false)
    if (!resultado.ok) {
      setFeedback({ tipo: "error", mensaje: resultado.message })
      return
    }
    setServicios(resultado.data.landing_config.servicios)
    setConfig(resultado.data.landing_config)
    setEnabled(resultado.data.landing_enabled)
    setFeedback({ tipo: "ok", mensaje: "Landing actualizada correctamente ✓" })
  }

  return (
    <form onSubmit={guardar} className="mt-6 flex flex-col gap-5">
      {/* Switch de publicación */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Activar o desactivar la landing pública"
            onClick={() => setEnabled((prev) => !prev)}
            className={cn(
              "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
              enabled ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
            )}
          >
            <span
              className={cn(
                "inline-block size-4 rounded-full bg-white shadow transition-transform",
                enabled ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">
              {enabled ? "Landing pública activa" : "Landing pública desactivada"}
            </span>
            <span className="text-xs text-muted-foreground">
              {enabled
                ? `Visible en /${clinicSlug}`
                : "Los visitantes verán una pantalla de mantenimiento."}
            </span>
          </div>
        </div>
        <a
          href={`/${clinicSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted/50"
        >
          <ExternalLink className="size-4" />
          Ver landing
        </a>
      </section>

      {/* Hero */}
      <section className="grid gap-3 rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Bienvenida (Hero)
        </h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ln-hero">Título principal</Label>
          <Input
            id="ln-hero"
            value={config.hero_titulo ?? ""}
            maxLength={LANDING_LIMITES.corto}
            placeholder={`Bienvenido a ${nombre}`}
            onChange={(e) => patch({ hero_titulo: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ln-sub">Subtítulo / descripción corta</Label>
          <Input
            id="ln-sub"
            value={config.hero_subtitulo ?? ""}
            maxLength={LANDING_LIMITES.medio}
            placeholder="Atención médica de calidad, agenda tu cita en minutos."
            onChange={(e) => patch({ hero_subtitulo: e.target.value })}
          />
        </div>
      </section>

      {/* Sobre nosotros */}
      <section className="grid gap-3 rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Sobre nosotros
        </h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ln-sobre">Presentación / misión / biografía</Label>
          <textarea
            id="ln-sobre"
            rows={5}
            value={config.sobre_nosotros ?? ""}
            maxLength={LANDING_LIMITES.largo}
            placeholder="Cuenta quiénes son, su misión y la experiencia del equipo médico…"
            onChange={(e) => patch({ sobre_nosotros: e.target.value })}
            className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
      </section>

      {/* Horarios y redes */}
      <section className="grid gap-3 rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Horarios y redes sociales
        </h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ln-horarios">Horarios de atención visibles</Label>
          <textarea
            id="ln-horarios"
            rows={3}
            value={config.horarios ?? ""}
            maxLength={LANDING_LIMITES.medio}
            placeholder="Lunes a viernes: 8:00 am – 5:00 pm · Sábados: 8:00 am – 12:00 m"
            onChange={(e) => patch({ horarios: e.target.value })}
            className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ln-ig">Instagram</Label>
            <Input
              id="ln-ig"
              value={config.instagram ?? ""}
              maxLength={LANDING_LIMITES.corto}
              placeholder="@tuclinica"
              onChange={(e) => patch({ instagram: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ln-fb">Facebook</Label>
            <Input
              id="ln-fb"
              value={config.facebook ?? ""}
              maxLength={LANDING_LIMITES.corto}
              placeholder="tuclinica"
              onChange={(e) => patch({ facebook: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* Servicios destacados */}
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Servicios / tratamientos destacados
          </h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={servicios.length >= LANDING_LIMITES.servicios}
            onClick={agregarServicio}
          >
            <Plus className="size-4" />
            Añadir
          </Button>
        </div>

        {servicios.length === 0 ? (
          <p className="rounded-xl border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            Aún no hay servicios. Añade los tratamientos que quieras destacar.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {servicios.map((servicio, index) => (
              <li
                key={index}
                className="flex flex-col gap-2 rounded-xl border bg-background p-3 sm:flex-row sm:items-center"
              >
                <Input
                  value={servicio.titulo}
                  maxLength={LANDING_LIMITES.corto}
                  placeholder="Nombre del servicio"
                  aria-label={`Servicio ${index + 1}`}
                  onChange={(e) => actualizarServicio(index, { titulo: e.target.value })}
                  className="sm:w-56"
                />
                <Input
                  value={servicio.descripcion}
                  maxLength={LANDING_LIMITES.medio}
                  placeholder="Descripción breve (opcional)"
                  aria-label={`Descripción del servicio ${index + 1}`}
                  onChange={(e) =>
                    actualizarServicio(index, { descripcion: e.target.value })
                  }
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Quitar servicio ${index + 1}`}
                  onClick={() => quitarServicio(index)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {feedback && (
        <p
          role={feedback.tipo === "error" ? "alert" : "status"}
          className={cn(
            "rounded-xl border px-3 py-2 text-sm",
            feedback.tipo === "ok"
              ? "border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          {feedback.mensaje}
        </p>
      )}

      <Button type="submit" disabled={guardando} className="h-12 gap-2 text-base">
        {guardando ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <Save className="size-4" />
        )}
        {guardando ? "Guardando…" : "Guardar Landing Page"}
      </Button>


    </form>
  )
}
