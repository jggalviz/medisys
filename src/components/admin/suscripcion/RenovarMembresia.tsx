"use client"

/**
 * Renovación de membresía: desglose USD/VES con tasa BCV, datos oficiales de
 * Pago Móvil del SaaS y reporte del pago (referencia, banco, comprobante).
 */
import { useState } from "react"
import { BadgeCheck, Copy, LoaderCircle, UploadCloud } from "lucide-react"

import { registrarPagoSuscripcion } from "@/app/actions/suscripcion"
import type { RenovacionInfo } from "@/app/actions/suscripcion"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import { BANCOS_VENEZUELA } from "@/lib/bancos"
import { formatBs, formatUSD } from "@/lib/format"
import { formatearVencimiento } from "@/lib/suscripcion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const BUCKET_COMPROBANTES = "comprobantes"
const MAX_FILE_MB = 5

type Props = { info: RenovacionInfo }

export function RenovarMembresia({ info }: Props) {
  const supabase = createSupabaseClient()
  const [banco, setBanco] = useState("")
  const [referencia, setReferencia] = useState("")
  const [telefono, setTelefono] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)

  async function copiar(valor: string) {
    try {
      await navigator.clipboard.writeText(valor)
      setCopiado(valor)
      window.setTimeout(() => setCopiado(null), 1600)
    } catch {
      /* clipboard no disponible */
    }
  }

  async function subirComprobante(target: File): Promise<string | null> {
    const limpio = target.name
      .toLowerCase()
      .replace(/[^a-z0-9.\-]+/g, "-")
      .replace(/-+/g, "-")
    const path = `suscripciones/${info.tenantId}/${Date.now()}-${limpio}`

    setUploading(true)
    const { data, error: uploadError } = await supabase.storage
      .from(BUCKET_COMPROBANTES)
      .upload(path, target, {
        contentType: target.type || "image/jpeg",
        cacheControl: "31536000",
        upsert: false,
      })
    setUploading(false)

    if (uploadError || !data) {
      setError(
        uploadError?.message ??
          "No se pudo subir el comprobante. Puedes enviarlo por otro medio."
      )
      return null
    }
    const { data: publicUrl } = supabase.storage
      .from(BUCKET_COMPROBANTES)
      .getPublicUrl(data.path)
    return publicUrl.publicUrl
  }

  function elegirArchivo(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    event.target.value = ""
    setError(null)
    if (!selected) return
    if (selected.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`El comprobante debe pesar menos de ${MAX_FILE_MB} MB.`)
      return
    }
    setFile(selected)
  }

  async function enviar(event: React.FormEvent) {
    event.preventDefault()
    if (submitting || uploading) return
    setError(null)

    setSubmitting(true)
    let comprobanteUrl: string | null = null
    if (file) {
      comprobanteUrl = await subirComprobante(file)
      if (!comprobanteUrl) {
        setSubmitting(false)
        return
      }
    }

    const resultado = await registrarPagoSuscripcion({
      tenantId: info.tenantId,
      bancoOrigen: banco,
      referenciaPago: referencia,
      telefonoEmisor: telefono,
      comprobanteUrl,
    })
    setSubmitting(false)

    if (!resultado.ok) {
      setError(resultado.message)
      return
    }
    setOk(true)
  }

  if (ok || info.pendiente) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-300/60 bg-emerald-50 p-6 text-center dark:border-emerald-500/40 dark:bg-emerald-950/40">
        <BadgeCheck className="size-9 text-emerald-600" />
        <p className="text-lg font-semibold text-emerald-900 dark:text-emerald-200">
          ¡Pago registrado con éxito!
        </p>
        <p className="text-sm text-emerald-800/90 dark:text-emerald-300">
          Nuestro equipo validará el reporte en breve. Al aprobarse se sumarán
          +30 días a tu fecha de vencimiento.
        </p>
        {info.pendiente && (
          <p className="text-xs text-emerald-800/80 dark:text-emerald-400">
            Reporte en revisión · ref. {info.pendiente.referencia}
          </p>
        )}
      </div>
    )
  }

  const datos = [
    { label: "Banco", valor: info.pagoMovil.banco },
    { label: "Cédula / RIF", valor: info.pagoMovil.cedula },
    { label: "Teléfono", valor: info.pagoMovil.telefono },
    { label: "Titular", valor: info.pagoMovil.titular },
  ]

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {info.planLabel} · renovación mensual
            </span>
            <span className="text-2xl font-bold tracking-tight">
              {formatUSD(info.precioUsd)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-sm font-semibold">{formatBs(info.montoVes)}</span>
            <p className="text-xs text-muted-foreground">
              Tasa BCV oficial: {info.tasaBCV.toFixed(2)} Bs./USD
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Vencimiento actual: {formatearVencimiento(info.venceAt)} · al aprobarse
          se sumarán +30 días.
        </p>
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Datos para el Pago Móvil
        </h2>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {datos.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-2 rounded-xl border bg-background px-3 py-2"
            >
              <div className="flex min-w-0 flex-col">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </dt>
                <dd className="truncate text-sm font-semibold">{item.valor}</dd>
              </div>
              <button
                type="button"
                onClick={() => void copiar(item.valor)}
                aria-label={`Copiar ${item.label}`}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {copiado === item.valor ? (
                  <BadgeCheck className="size-4 text-emerald-600" />
                ) : (
                  <Copy className="size-4" />
                )}
              </button>
            </div>
          ))}
        </dl>
      </section>

      <form onSubmit={enviar} className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Reporta tu pago
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rn-banco">Banco de origen *</Label>
            <select
              id="rn-banco"
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
              required
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="">Selecciona un banco…</option>
              {BANCOS_VENEZUELA.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rn-referencia">Referencia de pago *</Label>
            <Input
              id="rn-referencia"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="4 a 6 dígitos"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rn-telefono">Teléfono emisor *</Label>
            <Input
              id="rn-telefono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              inputMode="tel"
              placeholder="0414-1234567"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rn-comprobante">Comprobante (opcional)</Label>
            <label
              htmlFor="rn-comprobante"
              className={cn(
                "flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-2.5 text-sm",
                file ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {uploading ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <UploadCloud className="size-4" />
              )}
              <span className="truncate">
                {uploading
                  ? "Subiendo…"
                  : file
                    ? file.name
                    : "Adjuntar imagen o PDF (máx. 5 MB)"}
              </span>
            </label>
            <input
              id="rn-comprobante"
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={elegirArchivo}
            />
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={submitting || uploading}
          className="h-12 gap-2 text-base"
        >
          {submitting && <LoaderCircle className="size-4 animate-spin" />}
          {submitting ? "Enviando reporte…" : "Reportar pago"}
        </Button>
        <p className="text-xs text-muted-foreground">
          El monto a transferir es {formatUSD(info.precioUsd)} ({formatBs(info.montoVes)})
          a la tasa BCV del día.
        </p>
      </form>

    </div>
  )
}

