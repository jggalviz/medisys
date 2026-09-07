"use client"

/**
 * Paso 4 del wizard: pago de la reserva.
 *
 * - Resumen (paciente, especialista, fecha/hora y monto).
 * - Cuentas de cobro del tenant: Pago Móvil / Zelle (`datos_pago_movil`).
 * - Número de referencia + comprobante subido a Supabase Storage
 *   (bucket 'comprobantes') y confirmación vía Server Action.
 */
import { useEffect, useMemo, useState } from "react"
import {
  BadgeCheck,
  CheckCircle2,
  Copy,
  FileImage,
  FileUp,
  ImageUp,
  Landmark,
  LoaderCircle,
  Lock,
  ShieldAlert,
  Smartphone,
  TimerReset,
  Trash2,
  WalletCards,
} from "lucide-react"

import type { Appointment, Doctor, Profile, Tenant } from "@/types/database"
import { confirmBookingPayment } from "@/app/actions/booking"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import { formatLongDate } from "@/lib/date"
import { cuentaDetalle, cuentaTitulo, doctorNombre, formatMonto, perfilNombre } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type Props = {
  tenant: Tenant
  patient: Profile
  doctor: Doctor
  appointment: Appointment
  /** MS restantes del lock (lo controla el wizard). */
  lockRemainingMs: number
  onSuccess: (appointment: Appointment) => void
  onLockExpired: () => void
}

const MAX_FILE_MB = 5
const BUCKET_COMPROBANTES = "comprobantes"

function formatoRestante(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const min = Math.floor(total / 60)
  const sec = total % 60
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

/** Fila resumen de la reserva (paciente / especialista / fecha). */
function SummaryRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  )
}

export function StepPayment({
  tenant,
  patient,
  doctor,
  appointment,
  lockRemainingMs,
  onSuccess,
  onLockExpired,
}: Props) {
  const supabase = useMemo(() => createSupabaseClient(), [])

  const [referencia, setReferencia] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const lockDanger = lockRemainingMs < 120_000
  const cuentas = tenant.datos_pago_movil?.cuentas ?? []
  const instrucciones = tenant.datos_pago_movil?.instrucciones ?? null

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto)
    } catch {
      // Sin permiso de portapapeles: el usuario puede copiar manualmente.
    }
  }

  function limpiarArchivo() {
    setFile(null)
    setUploadedUrl(null)
    setFileError(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }

  function elegirArchivo(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    event.target.value = ""
    setFileError(null)

    if (!selected) return
    if (selected.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`El comprobante debe pesar menos de ${MAX_FILE_MB} MB.`)
      return
    }
    if (!selected.type.startsWith("image/") && selected.type !== "application/pdf") {
      setFileError("Formato no soportado. Usa una foto (JPG/PNG) o PDF.")
      return
    }

    setFile(selected)
    setUploadedUrl(null)
    setPreviewUrl(URL.createObjectURL(selected))
  }

  /** Sube el comprobante a Supabase Storage y devuelve su URL pública. */
  async function subirComprobante(target: File): Promise<string | null> {
    if (uploadedUrl) return uploadedUrl

    const nameLimpio = target.name
      .toLowerCase()
      .replace(/[^a-z0-9.\-]+/g, "-")
      .replace(/-+/g, "-")
    const path = `${appointment.id}/${Date.now()}-${nameLimpio}`

    setUploading(true)
    setFileError(null)

    const { data, error } = await supabase.storage
      .from(BUCKET_COMPROBANTES)
      .upload(path, target, {
        contentType: target.type || "image/jpeg",
        cacheControl: "31536000",
        upsert: false,
      })

    setUploading(false)

    if (error) {
      setFileError(
        error.message ||
          "No se pudo subir el comprobante. Revisa que el bucket 'comprobantes' exista."
      )
      return null
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_COMPROBANTES)
      .getPublicUrl(data.path)

    setUploadedUrl(publicUrlData.publicUrl)
    return publicUrlData.publicUrl
  }

  async function handlePay() {
    if (submitting || uploading || !referencia.trim()) return

    setSubmitError(null)
    setSubmitting(true)

    let comprobanteUrl = uploadedUrl
    if (file && !comprobanteUrl) {
      comprobanteUrl = await subirComprobante(file)
      if (!comprobanteUrl) {
        setSubmitting(false)
        return
      }
    }

    const result = await confirmBookingPayment(
      appointment.id,
      referencia.trim(),
      comprobanteUrl
    )

    setSubmitting(false)

    if (result.ok) {
      onSuccess(result.data)
      return
    }

    if (result.code === "LOCK_EXPIRED") {
      onLockExpired()
      return
    }
    setSubmitError(result.message)
  }

  const fechaLegible = formatLongDate(appointment.fecha)
  const pagoValido = referencia.trim().length >= 4

  function CopyButton({ value }: { value: string }) {
    const [copied, setCopied] = useState(false)

    return (
      <button
        type="button"
        onClick={() => {
          void copiar(value)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1800)
        }}
        aria-label={`Copiar ${value}`}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {copied ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Confirma y paga</h2>
          <span
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums",
              lockDanger
                ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "border-border bg-card text-muted-foreground"
            )}
          >
            <TimerReset className={cn("size-3.5", lockDanger && "animate-pulse")} />
            {formatoRestante(lockRemainingMs)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          La hora se libera sola si no completas el pago a tiempo.
        </p>
      </header>

      <section className="rounded-2xl border bg-card p-4" aria-label="Resumen de la cita">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <BadgeCheck className="size-4 text-primary" /> Resumen
        </h3>
        <SummaryRow label="Paciente" value={perfilNombre(patient)} />
        <SummaryRow label="Especialista" value={doctorNombre(doctor)} />
        <SummaryRow
          label="Fecha y hora"
          value={`${fechaLegible} · ${appointment.hora}`}
        />
        <Separator className="my-2" />
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm font-medium">Total a pagar</span>
          <span className="text-xl font-bold text-primary">{formatMonto(appointment.monto)}</span>
        </div>
      </section>

      {cuentas.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Datos bancarios">
          <div className="flex items-center gap-2">
            <Landmark className="size-5 text-primary" />
            <h3 className="font-semibold">Paga por Pago Móvil o Zelle</h3>
          </div>

          {instrucciones && (
            <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {instrucciones}
            </p>
          )}

          <div className="flex flex-col gap-3">
            {cuentas.map((cuenta, index) => {
              const esMovil = cuenta.metodo === "pago_movil"
              const filas = [
                { label: "Banco", value: cuenta.banco },
                { label: "Titular", value: cuenta.titular },
                { label: "Cédula / RIF", value: cuenta.cedula_rif },
                {
                  label: esMovil ? "Teléfono Pago Móvil" : "Correo Zelle",
                  value: cuentaDetalle(cuenta),
                },
              ].filter((fila): fila is { label: string; value: string } => Boolean(fila.value))

              return (
                <div
                  key={`${cuenta.metodo}-${index}`}
                  className="overflow-hidden rounded-2xl border bg-card"
                >
                  <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                    <span className="flex items-center gap-2 font-semibold">
                      <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {esMovil ? (
                          <Smartphone className="size-4" />
                        ) : (
                          <WalletCards className="size-4" />
                        )}
                      </span>
                      {cuentaTitulo(cuenta)}
                    </span>
                    <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {esMovil ? "Pago Móvil" : "Zelle"}
                    </span>
                  </div>
                  <dl className="flex flex-col gap-1 px-3 py-2">
                    {filas.map((fila) => (
                      <div
                        key={fila.label}
                        className="flex items-center justify-between gap-3 py-0.5"
                      >
                        <dt className="text-xs text-muted-foreground">{fila.label}</dt>
                        <dd className="flex items-center gap-1 text-right text-sm font-medium">
                          <span className="tabular-nums">{fila.value}</span>
                          <CopyButton value={fila.value} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {cuentas.length === 0 && (
        <Alert>
          <ShieldAlert className="size-4" />
          <AlertTitle>La clínica no publicó datos de pago</AlertTitle>
          <AlertDescription>
            Completa la reserva y el personal te contactará para coordinar el pago.
          </AlertDescription>
        </Alert>
      )}

      <section className="flex flex-col gap-4" aria-label="Datos del pago">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pago-referencia">
            Número de referencia (Pago Móvil / Zelle) *
          </Label>
          <Input
            id="pago-referencia"
            name="referencia_pago"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Ej. 045821"
            maxLength={20}
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Si pagaste por Pago Móvil, es el código de 6 dígitos que te dio tu banco.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pago-comprobante">Comprobante (opcional, recomendado)</Label>
          <input
            id="pago-comprobante"
            name="comprobante"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={elegirArchivo}
            className="sr-only"
          />
          {!file ? (
            <label
              htmlFor="pago-comprobante"
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors",
                uploading
                  ? "pointer-events-none opacity-60"
                  : "hover:border-primary/50 hover:bg-muted/40"
              )}
            >
              {uploading ? (
                <>
                  <LoaderCircle className="size-6 animate-spin text-primary" />
                  <span className="text-sm font-medium">Subiendo comprobante…</span>
                </>
              ) : (
                <>
                  <ImageUp className="size-6 text-primary" />
                  <span className="text-sm font-medium">
                    Toca para adjuntar la captura del pago
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Foto (JPG/PNG) o PDF · máx. {MAX_FILE_MB} MB
                  </span>
                </>
              )}
            </label>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- Vista previa local del comprobante
                <img
                  src={previewUrl}
                  alt="Vista previa del comprobante"
                  className="size-12 shrink-0 rounded-lg object-cover"
                />
              )}
              {!previewUrl && (
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <FileImage className="size-5" />
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {uploadedUrl ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="size-3.5" /> Comprobante subido
                    </span>
                  ) : (
                    "Listo para subir al confirmar"
                  )}
                </span>
              </span>
              <button
                type="button"
                onClick={limpiarArchivo}
                aria-label="Quitar comprobante"
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          )}

          {fileError && (
            <Alert variant="destructive" className="mt-1">
              <FileUp className="size-4" />
              <AlertTitle>Problema con el comprobante</AlertTitle>
              <AlertDescription>{fileError}</AlertDescription>
            </Alert>
          )}
        </div>
      </section>

      {submitError && (
        <Alert variant="destructive">
          <ShieldAlert className="size-4" />
          <AlertTitle>No se pudo confirmar el pago</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 backdrop-blur">
        <Button
          type="button"
          disabled={!pagoValido || uploading || submitting}
          onClick={handlePay}
          className="h-12 w-full gap-2 rounded-xl text-base"
        >
          {(uploading || submitting) && <LoaderCircle className="size-4 animate-spin" />}
          {submitting
            ? "Confirmando pago…"
            : uploading
              ? "Subiendo comprobante…"
              : "Ya transferí · Confirmar pago"}
          {!uploading && !submitting && <Lock className="size-4" />}
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Tu cita queda <strong>pendiente</strong> hasta que la clínica valide el pago.
        </p>
      </div>
    </div>
  )
}

