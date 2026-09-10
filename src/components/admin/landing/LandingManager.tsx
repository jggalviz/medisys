"use client"

/**
 * Editor de la Landing Page del tenant (/admin/landing).
 * Switch de publicación + campos preestablecidos + servicios destacados.
 */
import { useState } from "react"
import {
  AtSign,
  BadgeCheck,
  CreditCard,
  ExternalLink,
  GraduationCap,
  IdCard,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react"

import { updateTenantLandingConfig } from "@/app/actions/landing"
import type {
  LandingConfig,
  LandingFaq,
  LandingServicio,
  PlanTenant,
} from "@/types/database"
import { LANDING_LIMITES, METODOS_PAGO } from "@/lib/landing"
import { formatBs, formatUSD } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type Props = {
  tenantId: string
  clinicSlug: string
  nombre: string
  planType: PlanTenant | null
  precioConsultaBase: number | null
  tasaBCV: number
  inicial: { enabled: boolean; config: LandingConfig }
}

type Feedback = { tipo: "ok" | "error"; mensaje: string } | null

const METODO_ICONO: Record<string, typeof CreditCard> = {
  "Pago Móvil": CreditCard,
  Transferencia: CreditCard,
  Zelle: CreditCard,
  Efectivo: CreditCard,
  "Tarjeta (débito/crédito)": CreditCard,
  "Pago en recepción": CreditCard,
  "Punto de venta": CreditCard,
}

export function LandingManager({
  tenantId,
  clinicSlug,
  nombre,
  planType,
  precioConsultaBase,
  tasaBCV,
  inicial,
}: Props) {
  const [enabled, setEnabled] = useState(inicial.enabled)
  const [config, setConfig] = useState<LandingConfig>(inicial.config)
  const [servicios, setServicios] = useState<LandingServicio[]>(inicial.config.servicios)
  const [faq, setFaq] = useState<LandingFaq[]>(inicial.config.faq)
  const [guardando, setGuardando] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const metodosPago = config.metodos_pago

  function patch(parcial: Partial<LandingConfig>) {
    setConfig((prev) => ({ ...prev, ...parcial }))
  }

  function alternarMetodo(metodo: string) {
    const activo = metodosPago.includes(metodo)
    patch({
      metodos_pago: activo
        ? metodosPago.filter((m) => m !== metodo)
        : [...metodosPago, metodo].slice(0, LANDING_LIMITES.metodosPago),
    })
  }

  function actualizarFaq(index: number, parcial: Partial<LandingFaq>) {
    setFaq((prev) => prev.map((f, i) => (i === index ? { ...f, ...parcial } : f)))
  }

  function agregarFaq() {
    if (faq.length >= LANDING_LIMITES.faq) return
    setFaq((prev) => [...prev, { pregunta: "", respuesta: "" }])
  }

  function quitarFaq(index: number) {
    setFaq((prev) => prev.filter((_, i) => i !== index))
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
        faq: faq.filter((f) => f.pregunta.trim().length > 0),
      },
    })

    setGuardando(false)
    if (!resultado.ok) {
      setFeedback({ tipo: "error", mensaje: resultado.message })
      return
    }
    setServicios(resultado.data.landing_config.servicios)
    setFaq(resultado.data.landing_config.faq)
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
          Ver mi perfil público
        </a>
      </section>

      {/* Hero */}
      <section className="grid gap-3 rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Encabezado del perfil (Hero)
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

      {/* Información profesional y autoridad */}
      <section className="grid gap-3 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Información profesional y autoridad
          </h2>
          {planType && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {planType === "PRO" ? "Plan PRO" : "Plan Clínica"}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ln-subesp">Subespecialidades o enfoque clínico</Label>
          <Input
            id="ln-subesp"
            value={config.subespecialidades ?? ""}
            maxLength={LANDING_LIMITES.medio}
            placeholder="Ej.: Cardiología intervencionista, ecocardiografía"
            onChange={(e) => patch({ subespecialidades: e.target.value })}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ln-mpps">
              <span className="inline-flex items-center gap-1.5">
                <IdCard className="size-3.5 text-primary" /> N° MPPS / Registro Sanitario
              </span>
            </Label>
            <Input
              id="ln-mpps"
              value={config.mpps ?? ""}
              maxLength={LANDING_LIMITES.corto}
              placeholder="Ej.: MPPS 123456"
              onChange={(e) => patch({ mpps: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ln-colegio">
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="size-3.5 text-primary" /> N° Colegio Médico
              </span>
            </Label>
            <Input
              id="ln-colegio"
              value={config.colegio_medico ?? ""}
              maxLength={LANDING_LIMITES.corto}
              placeholder="Ej.: CM 98765"
              onChange={(e) => patch({ colegio_medico: e.target.value })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ln-universidad">
            <span className="inline-flex items-center gap-1.5">
              <GraduationCap className="size-3.5 text-primary" /> Universidad / institución de egreso
            </span>
          </Label>
          <Input
            id="ln-universidad"
            value={config.universidad ?? ""}
            maxLength={LANDING_LIMITES.medio}
            placeholder="Ej.: Universidad Central de Venezuela (UCV)"
            onChange={(e) => patch({ universidad: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Badges de atención (opcional)</Label>
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.badges.emergencias}
                onChange={(e) =>
                  patch({
                    badges: { ...config.badges, emergencias: e.target.checked },
                  })
                }
                className="size-4 accent-[var(--primary)]"
              />
              <ShieldCheck className="size-4 text-primary" />
              Atención de emergencias
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.badges.telemedicina}
                onChange={(e) =>
                  patch({
                    badges: { ...config.badges, telemedicina: e.target.checked },
                  })
                }
                className="size-4 accent-[var(--primary)]"
              />
              <Sparkles className="size-4 text-primary" />
              Consulta online / Telemedicina
            </label>
          </div>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Biografía / Presentación médica (Sobre mí)
        </h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ln-sobre">Sobre mí</Label>
          <textarea
            id="ln-sobre"
            rows={5}
            value={config.sobre_nosotros ?? ""}
            maxLength={LANDING_LIMITES.largo}
            placeholder="Describe tu formación, experiencia y enfoque de atención…"
            onChange={(e) => patch({ sobre_nosotros: e.target.value })}
            className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
      </section>

      {/* Ubicación, horarios y logística */}
      <section className="grid gap-3 rounded-2xl border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <MapPin className="size-4 text-primary" />
          Ubicación, horarios y logística
        </h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ln-dir">Dirección detallada del consultorio</Label>
          <Input
            id="ln-dir"
            value={config.direccion_detallada ?? ""}
            maxLength={LANDING_LIMITES.medio}
            placeholder="Av. Principal, Torre Médica, Piso 3, Oficina 3-B"
            onChange={(e) => patch({ direccion_detallada: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ln-ref">Punto de referencia</Label>
          <Input
            id="ln-ref"
            value={config.punto_referencia ?? ""}
            maxLength={LANDING_LIMITES.medio}
            placeholder="Frente al Centro Médico, al lado de la farmacia…"
            onChange={(e) => patch({ punto_referencia: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ln-horarios">Horarios de atención visibles</Label>
          <textarea
            id="ln-horarios"
            rows={3}
            value={config.horarios ?? ""}
            maxLength={LANDING_LIMITES.medio}
            placeholder="Lunes a Viernes 8:00 AM - 1:00 PM · Sábados 8:00 AM - 12:00 M"
            onChange={(e) => patch({ horarios: e.target.value })}
            className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Métodos de pago aceptados</Label>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set([...METODOS_PAGO, ...metodosPago])).map((metodo) => {
              const activo = metodosPago.includes(metodo)
              const Icono = METODO_ICONO[metodo] ?? CreditCard
              return (
                <button
                  key={metodo}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => alternarMetodo(metodo)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    activo
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <Icono className="size-3.5" />
                  {metodo}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* Redes sociales */}
      <section className="grid gap-3 rounded-2xl border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <AtSign className="size-4 text-primary" />
          Redes sociales
        </h2>
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

      {/* Preguntas frecuentes */}
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <MessageCircle className="size-4 text-primary" />
            Preguntas frecuentes (FAQ)
          </h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={faq.length >= LANDING_LIMITES.faq}
            onClick={agregarFaq}
          >
            <Plus className="size-4" />
            Añadir
          </Button>
        </div>

        {faq.length === 0 ? (
          <p className="rounded-xl border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            Aún no hay preguntas. Añade las dudas más comunes de tus pacientes.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {faq.map((item, index) => (
              <li
                key={index}
                className="flex flex-col gap-2 rounded-xl border bg-background p-3"
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={item.pregunta}
                    maxLength={LANDING_LIMITES.medio}
                    placeholder="¿Qué debo llevar a mi primera consulta?"
                    aria-label={`Pregunta ${index + 1}`}
                    onChange={(e) => actualizarFaq(index, { pregunta: e.target.value })}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Quitar pregunta ${index + 1}`}
                    onClick={() => quitarFaq(index)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                <textarea
                  rows={2}
                  value={item.respuesta}
                  maxLength={LANDING_LIMITES.largo}
                  placeholder="Respuesta breve…"
                  aria-label={`Respuesta ${index + 1}`}
                  onChange={(e) => actualizarFaq(index, { respuesta: e.target.value })}
                  className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
              </li>
            ))}
          </ul>
        )}
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

        {/* Costo de consulta (referencial) */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-background px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <CreditCard className="size-4 text-primary" />
            Costo base de la consulta
          </span>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">
              {precioConsultaBase != null ? formatUSD(precioConsultaBase) : "No definido"}
            </span>
            <span className="text-muted-foreground">
              Tasa BCV referencial: {tasaBCV.toFixed(2)} Bs./USD
              {precioConsultaBase != null
                ? ` · ≈ ${formatBs(precioConsultaBase * tasaBCV)}`
                : ""}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          El monto proviene del módulo de Especialistas. Actualízalo allí para
          reflejarlo aquí y en el flujo de reserva.
        </p>

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
