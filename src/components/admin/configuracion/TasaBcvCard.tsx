"use client"

/**
 * MEDISYS · Tasa oficial BCV y multimoneda (módulo de administración)
 * -------------------------------------------------------------------
 * Tarjeta de control del motor de tasa:
 *   - Muestra la tasa vigente, su origen (BCV · manual · respaldo) y vigencia.
 *   - Permite forzar la consulta al BCV (`modo: "auto"`).
 *   - Permite la sobreescritura manual del administrador (`source = MANUAL`).
 *   - Switch de actualización automática: al activarlo refresca desde el BCV;
 *     al desactivarlo congela la tasa vigente como manual.
 *
 * Persiste contra `POST /api/admin/bcv-rate`.
 */
import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  BadgeDollarSign,
  CloudDownload,
  LoaderCircle,
  Lock,
  TriangleAlert,
} from "lucide-react"

import type { OrigenTasa, TasaBcv, TasaRegistro } from "@/types/admin"
import { tasaBcvSchema } from "@/lib/validations/admin"
import {
  apiRefrescarTasaBcv,
  apiRegistrarTasaManual,
} from "@/lib/api-admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatBs, formatUSD } from "@/lib/format"
import { fechaHoyVenezuela } from "@/lib/date"
import { cn } from "@/lib/utils"

const ORIGEN_LABEL: Record<OrigenTasa, string> = {
  bcv: "Oficial BCV",
  manual: "Manual (administrador)",
  respaldo: "Respaldo",
}

const ORIGEN_ESTILO: Record<OrigenTasa, string> = {
  bcv: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  manual: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  respaldo: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
}

function fechaLegible(iso: string | null): string {
  if (!iso) return "sin registro"
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return "sin registro"
  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Caracas",
  }).format(fecha)
}

export function TasaBcvCard({
  clinicSlug,
  tasaInicial,
  historialInicial,
  puedeEditar,
}: {
  clinicSlug: string
  tasaInicial: TasaBcv
  historialInicial: TasaRegistro[]
  puedeEditar: boolean
}) {
  const [tasa, setTasa] = useState<TasaBcv>(tasaInicial)
  const [historial, setHistorial] = useState<TasaRegistro[]>(historialInicial)
  const [rateTexto, setRateTexto] = useState(String(tasaInicial.rate))
  const [fecha, setFecha] = useState(tasaInicial.effectiveDate)
  const [ocupado, setOcupado] = useState<"auto" | "manual" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const router = useRouter()

  function aplicarExito(mensaje: string, nueva: TasaBcv) {
    setTasa(nueva)
    setRateTexto(String(nueva.rate))
    setFecha(nueva.effectiveDate)
    setHistorial((previo) => [
      {
        id: `local-${nueva.effectiveDate}-${nueva.source}`,
        currency: nueva.currency,
        rate: nueva.rate,
        effectiveDate: nueva.effectiveDate,
        source: nueva.source,
        autoUpdate: nueva.autoUpdate,
        actualizadoEn: nueva.actualizadoEn,
      },
      ...previo.filter(
        (registro) =>
          !(
            registro.effectiveDate === nueva.effectiveDate &&
            registro.source === nueva.source
          )
      ),
    ].slice(0, 5))
    setError(null)
    setOk(mensaje)
    router.refresh()
  }

  /** Fuerza la consulta al BCV y persiste la tasa oficial del día. */
  async function refrescarDesdeBcv() {
    setOcupado("auto")
    const respuesta = await apiRefrescarTasaBcv(clinicSlug)
    setOcupado(null)

    if (!respuesta.ok) {
      setOk(null)
      setError(respuesta.message)
      return
    }
    aplicarExito(
      `Tasa actualizada desde el BCV (${formatBs(respuesta.data.rate)}).`,
      respuesta.data
    )
  }

  /** Sobreescritura manual de la tasa (override del administrador). */
  async function guardarManual(autoUpdate: boolean) {
    const valido = tasaBcvSchema.safeParse({
      currency: tasa.currency,
      rate: rateTexto,
      effectiveDate: fecha,
      source: "MANUAL",
      autoUpdate,
    })
    if (!valido.success) {
      setOk(null)
      setError(valido.error.issues[0]?.mensaje ?? valido.error.message)
      return
    }

    setOcupado("manual")
    const respuesta = await apiRegistrarTasaManual(clinicSlug, valido.data)
    setOcupado(null)

    if (!respuesta.ok) {
      setOk(null)
      setError(respuesta.message)
      return
    }
    aplicarExito(
      autoUpdate
        ? "Tasa manual registrada y actualización automática activada."
        : "Tasa manual registrada. Se usará como tasa vigente.",
      respuesta.data
    )
  }

  return (
    <section
      aria-labelledby="tasa-bcv-titulo"
      className="mt-6 flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BadgeDollarSign className="size-5" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col">
            <h2 id="tasa-bcv-titulo" className="font-semibold">
              Tasa oficial BCV y multimoneda
            </h2>
            <p className="text-sm text-muted-foreground">
              Base para convertir los precios en dólares a bolívares en la
              reserva, la caja y las facturas.
            </p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
            ORIGEN_ESTILO[tasa.origen]
          )}
        >
          {ORIGEN_LABEL[tasa.origen]}
        </span>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Dato
          titulo="Tasa vigente"
          valor={formatBs(tasa.rate)}
          detalle={`1 USD = ${formatBs(tasa.rate)}`}
          destacado
        />
        <Dato
          titulo="Precio de referencia"
          valor={formatUSD(100)}
          detalle={`= ${formatBs(100 * tasa.rate)}`}
        />
        <Dato
          titulo="Vigencia"
          valor={tasa.effectiveDate}
          detalle={`Actualizada: ${fechaLegible(tasa.actualizadoEn)}`}
        />
      </div>

      <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {tasa.detalle}
      </p>

      {(error || ok) && (
        <p
          role="status"
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
            error
              ? "bg-destructive/10 text-destructive"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          )}
        >
          {error && (
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
          )}
          {error ?? ok}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => void refrescarDesdeBcv()}
          disabled={!puedeEditar || ocupado !== null}
          className="h-11 gap-2 rounded-xl px-5"
        >
          {ocupado === "auto" ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <CloudDownload className="size-4" aria-hidden="true" />
          )}
          Consultar BCV ahora
        </Button>
        <span className="text-xs text-muted-foreground">
          Fuente: bcv.org.ve · respaldo automático en APIs públicas.
        </span>
      </div>

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium">Tasa manual (Bs/USD)</Label>
          <Input
            value={rateTexto}
            onChange={(evento) => setRateTexto(evento.target.value)}
            disabled={!puedeEditar}
            inputMode="decimal"
            placeholder="36,50"
            aria-invalid={Boolean(error)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium">Vigente desde</Label>
          <Input
            type="date"
            value={fecha}
            onChange={(evento) =>
              setFecha(evento.target.value || fechaHoyVenezuela())
            }
            disabled={!puedeEditar}
          />
        </div>

        <Button
          type="button"
          onClick={() => void guardarManual(tasa.autoUpdate)}
          disabled={!puedeEditar || ocupado !== null}
          className="h-11 gap-2 rounded-xl px-5"
        >
          {ocupado === "manual" && (
            <LoaderCircle className="size-4 animate-spin" />
          )}
          Guardar tasa manual
        </Button>
      </div>

      <div className="flex items-start justify-between gap-3 border-t pt-4">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-muted-foreground">
            <Lock className="size-4" aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              Actualización automática desde el BCV
            </span>
            <span className="text-xs text-muted-foreground">
              {tasa.autoUpdate
                ? "Activa: la plataforma consulta la tasa oficial cada día."
                : "Inactiva: se usará la última tasa registrada hasta que la cambies."}
            </span>
          </div>
        </div>
        <Switch
          activo={tasa.autoUpdate}
          deshabilitado={!puedeEditar || ocupado !== null}
          etiqueta="Actualización automática de la tasa BCV"
          onToggle={(valor) =>
            valor ? void refrescarDesdeBcv() : void guardarManual(false)
          }
        />
      </div>

      {historial.length > 0 && (
        <div className="flex flex-col gap-2 border-t pt-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Últimos registros
          </span>
          <ul className="flex flex-col divide-y rounded-xl border">
            {historial.map((registro) => (
              <li
                key={registro.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="font-medium tabular-nums">
                  {formatBs(registro.rate)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {registro.effectiveDate} · {registro.source}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function Dato({
  titulo,
  valor,
  detalle,
  destacado,
}: {
  titulo: string
  valor: string
  detalle: string
  destacado?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-xl border p-3",
        destacado && "border-primary/40 bg-primary/5"
      )}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {titulo}
      </span>
      <span className="text-lg font-bold tabular-nums">{valor}</span>
      <span className="text-xs text-muted-foreground">{detalle}</span>
    </div>
  )
}

function Switch({
  activo,
  deshabilitado,
  etiqueta,
  onToggle,
}: {
  activo: boolean
  deshabilitado?: boolean
  etiqueta: string
  onToggle: (valor: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={deshabilitado}
      onClick={() => onToggle(!activo)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
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
