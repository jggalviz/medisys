"use client"

/**
 * Paso 4 del wizard: forma de pago de la reserva.
 *
 * - Resumen de la cita (paciente, especialista, fecha/hora).
 * - Dos métodos:
 *     a) Pago Móvil (En línea): muestra las cuentas del tenant, pide
 *        teléfono emisor, número de referencia y captura del comprobante.
 *        Estado → 'pendiente_validacion'.
 *     b) Pagar en Recepción: aparta el cupo para pagar en caja el día de
 *        la cita (efectivo / punto de venta / Pago Móvil en sitio).
 *        Estado → 'pago_en_recepcion'.
 * - El comprobante se sube a Supabase Storage (bucket 'comprobantes').
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
import { registerAppointmentPayment } from "@/app/actions/booking"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import { formatLongDate } from "@/lib/date"
import {
  cuentaDetalle,
  doctorNombre,
  formatMonto,
  perfilNombre,
} from "@/lib/format"
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
/** Referencias de Pago Móvil/Zelle: entre 4 y 8 dígitos. */
const REFERENCIA_RE = /^\d{4,8}$/

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

/** Botón copiar de los datos bancarios. */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={() => {
        try {
          void navigator.clipboard.writeText(value)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1800)
        } catch {
          // Sin permiso de portapapeles: el usuario puede copiar manualmente.
        }
      }}
      aria-label={`Copiar ${value}`}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copied ? (
        <CheckCircle2 className="size-4 text-emerald-600" />
      ) : (
        <Copy className="size-4" />
      )}
    </button>
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

  const [metodo, setMetodo] = useState<"en_linea" | "recepcion">("en_linea")
  const [telefonoEmisor, setTelefonoEmisor] = useState("")
  const [bancoOrigen, setBancoOrigen] = useState("")
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
  const cuentasPagoMovil = cuentas.filter(
    (cuenta) =>
      cuenta.metodo === "pago_movil" && Boolean(cuenta.banco && cuenta.telefono)
  )
  const instrucciones = tenant.datos_pago_movil?.instrucciones ?? null

  /**
   * ¿La clínica publicó una cuenta de Pago Móvil completa?
   * (requiere banco + teléfono; la cédula/RIF se muestra si está cargada).
   */
  const tienePagoMovil = cuentasPagoMovil.length > 0

  /** Método efectivo: sin Pago Móvil, la reserva se paga en recepción. */
  const metodoEfectivo: "en_linea" | "recepcion" = tienePagoMovil
    ? metodo
    : "recepcion"

  // Fecha/hora de la cita desde `fecha_hora` (esquema lean, ISO local -04:00).
  const fechaHoraLocal = appointment.fecha_hora ?? ""
  const fechaCita = fechaHoraLocal.slice(0, 10)
  const horaCita = fechaHoraLocal.length >= 16 ? fechaHoraLocal.slice(11, 16) : ""
  const fechaLegible = fechaCita ? formatLongDate(fechaCita) : "Por confirmar"
  const monto = doctor.precio_consulta > 0 ? doctor.precio_consulta : null

  /** Etiqueta del turno guardado (con fallback desde la hora referencial). */
  const turnoLabel =
    appointment.turno === "manana" || horaCita.startsWith("08")
      ? "Turno Mañana"
      : appointment.turno === "tarde" || horaCita.startsWith("13")
        ? "Turno Tarde"
        : null

  /** El pago en línea es válido con teléfono + referencia + comprobante. */
  const pagoEnLineaValido =
    telefonoEmisor.trim().replace(/\D/g, "").length >= 7 &&
    REFERENCIA_RE.test(referencia.trim()) &&
    (file !== null || uploadedUrl !== null)

  const puedeEnviar = metodoEfectivo === "recepcion" || pagoEnLineaValido

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

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

    async function confirmarPago() {
    if (submitting || uploading) return
    setSubmitError(null)

    // Opción b) Pagar en recepción: no requiere datos extra.
    if (metodoEfectivo === "recepcion") {
      setSubmitting(true)
      const result = await registerAppointmentPayment(appointment.id, {
        metodo: "recepcion",
      })
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
      return
    }

    // Opción a) Pago Móvil en línea.
    const referenciaLimpia = referencia.trim()
    const telefonoLimpio = telefonoEmisor.trim()

    if (!REFERENCIA_RE.test(referenciaLimpia)) {
      setSubmitError("La referencia debe tener entre 4 y 8 dígitos.")
      return
    }
    if (telefonoLimpio.replace(/\D/g, "").length < 7) {
      setSubmitError("Indica el teléfono desde el cual realizaste el Pago Móvil.")
      return
    }
    if (!file && !uploadedUrl) {
      setSubmitError("Adjunta la captura del comprobante para pagar en línea.")
      return
    }

    setSubmitting(true)

    let comprobanteUrl = uploadedUrl
    if (file && !comprobanteUrl) {
      comprobanteUrl = await subirComprobante(file)
      if (!comprobanteUrl) {
        setSubmitting(false)
        return
      }
    }

    const result = await registerAppointmentPayment(appointment.id, {
      metodo: "en_linea",
      datos: {
        referenciaPago: referenciaLimpia,
        telefonoEmisor: telefonoLimpio,
        bancoOrigen: bancoOrigen.trim() || null,
        comprobanteUrl,
      },
    })

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
          Tu cupo queda apartado 15 minutos mientras eliges cómo pagar.
        </p>
      </header>

      {/* Resumen de la cita */}
      <section className="rounded-2xl border bg-card p-4" aria-label="Resumen de la cita">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <BadgeCheck className="size-4 text-primary" /> Resumen de la reserva
        </h3>

        {/* Consultorio / clínica */}
        {tenant.nombre && <SummaryRow label="Clínica" value={tenant.nombre} />}
        {tenant.direccion && (
          <SummaryRow label="Dirección" value={tenant.direccion} />
        )}
        {tenant.telefono && (
          <SummaryRow label="Recepción" value={tenant.telefono} />
        )}

        {/* Detalles de la cita */}
        <SummaryRow label="Paciente" value={perfilNombre(patient)} />
        <SummaryRow label="Especialidad" value={doctor.especialidad} />
        <SummaryRow label="Especialista" value={doctorNombre(doctor)} />
        <SummaryRow
          label="Fecha y turno"
          value={turnoLabel ? `${fechaLegible} · ${turnoLabel}` : fechaLegible}
        />

        {/* Monto / precio de la consulta */}
        {monto !== null ? (
          <>
            <Separator className="my-2" />
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-medium">Monto a pagar</span>
              <span className="text-xl font-bold text-primary">
                {formatMonto(monto)}
              </span>
            </div>
          </>
        ) : (
          <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
            El precio de la cita se confirmará al momento de realizar el pago
            en recepción.
          </p>
        )}
      </section>

      {/* Selector de método de pago: solo si la clínica tiene Pago Móvil */}
      {tienePagoMovil && (
        <section className="flex flex-col gap-3" aria-label="Elige el método de pago">
        <h3 className="font-semibold">¿Cómo quieres pagar?</h3>
        <div role="radiogroup" aria-label="Métodos de pago" className="flex flex-col gap-2">
          <button
            type="button"
            role="radio"
            aria-checked={metodo === "en_linea"}
            onClick={() => setMetodo("en_linea")}
            className={cn(
              "flex items-start gap-3 rounded-2xl border bg-card p-3.5 text-left transition-all",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.99]",
              metodo === "en_linea"
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "border-border hover:bg-muted/40"
            )}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Smartphone className="size-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold">Pago Móvil (En línea)</span>
              <span className="text-sm text-muted-foreground">
                Transfiere ahora desde tu banco y adjunta la captura del
                comprobante.
              </span>
            </span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={metodo === "recepcion"}
            onClick={() => setMetodo("recepcion")}
            className={cn(
              "flex items-start gap-3 rounded-2xl border bg-card p-3.5 text-left transition-all",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.99]",
              metodo === "recepcion"
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "border-border hover:bg-muted/40"
            )}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <WalletCards className="size-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold">Pagar en Recepción</span>
              <span className="text-sm text-muted-foreground">
                Efectivo, punto de venta o Pago Móvil el día de tu cita.
              </span>
            </span>
          </button>
        </div>
        </section>
      )}

      {!tienePagoMovil ? (
        <Alert>
          <ShieldAlert className="size-4" />
          <AlertTitle>La clínica no publicó datos de Pago Móvil</AlertTitle>
          <AlertDescription>
            Puedes completar la reserva y pagar en recepción el día de tu cita.
            La recepción te indicará cómo pagar en el momento.
          </AlertDescription>
        </Alert>
      ) : metodoEfectivo === "recepcion" ? (
        <div
          role="note"
          aria-label="Pago en recepción"
          className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200"
        >
          <span className="shrink-0 text-base leading-5" aria-hidden="true">
            🏥
          </span>
          <p className="leading-6">
            <strong>Tu cupo quedará apartado.</strong> Recuerda llegar con 15
            minutos de anticipación para realizar el pago en caja.
          </p>
        </div>
      ) : (
        <>
          {/* Datos de las cuentas Pago Móvil del tenant */}
          <section className="flex flex-col gap-3" aria-label="Cuentas de Pago Móvil">
              <div className="flex items-center gap-2">
                <Landmark className="size-5 text-primary" aria-hidden="true" />
                <h3 className="font-semibold">Datos para tu Pago Móvil</h3>
              </div>

              {instrucciones && (
                <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  {instrucciones}
                </p>
              )}

              {cuentasPagoMovil.map((cuenta, index) => {
                const filas = [
                  { label: "Banco", value: cuenta.banco },
                  { label: "Titular", value: cuenta.titular },
                  { label: "Cédula / RIF", value: cuenta.cedula_rif },
                  { label: "Teléfono", value: cuentaDetalle(cuenta) },
                ].filter((fila): fila is { label: string; value: string } => Boolean(fila.value))

                return (
                  <div
                    key={`${cuenta.metodo}-${index}`}
                    className="overflow-hidden rounded-2xl border bg-card"
                  >
                    <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                      <span className="flex items-center gap-2 font-semibold">
                        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Smartphone className="size-4" aria-hidden="true" />
                        </span>
                        {cuenta.banco ?? "Pago Móvil"}
                      </span>
                      <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Pago Móvil
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
          </section>

          {/* Formulario del Pago Móvil en línea */}
          <section className="flex flex-col gap-4" aria-label="Datos del Pago Móvil">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pago-telefono-emisor">
                Teléfono emisor (desde donde transferiste) *
              </Label>
              <Input
                id="pago-telefono-emisor"
                name="telefono_emisor"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0412-1234567"
                maxLength={20}
                value={telefonoEmisor}
                onChange={(e) => setTelefonoEmisor(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pago-banco-origen">Banco de origen (Opcional)</Label>
              <Input
                id="pago-banco-origen"
                name="banco_origen"
                autoComplete="off"
                placeholder="Ej. Banco de Venezuela"
                maxLength={40}
                value={bancoOrigen}
                onChange={(e) => setBancoOrigen(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pago-referencia">
                Número de referencia de la transacción *
              </Label>
              <Input
                id="pago-referencia"
                name="referencia_pago"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ej. 045821"
                maxLength={8}
                value={referencia}
                onChange={(e) => setReferencia(e.target.value.replace(/\D/g, ""))}
              />
              <p className="text-xs text-muted-foreground">
                Entre 4 y 8 dígitos (el Pago Móvil suele generar 6).
              </p>
            </div>

                        <div className="flex flex-col gap-1.5">
              <Label htmlFor="pago-comprobante">
                Captura del comprobante *
              </Label>
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
                      <span className="text-sm font-medium">
                        Subiendo comprobante…
                      </span>
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
        </>
      )}

      {submitError && (
        <Alert variant="destructive">
          <ShieldAlert className="size-4" />
          <AlertTitle>No se pudo completar el registro</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 backdrop-blur">
        <Button
          type="button"
          disabled={!puedeEnviar || uploading || submitting}
          onClick={() => void confirmarPago()}
          className="h-12 w-full gap-2 rounded-xl text-base"
        >
          {(uploading || submitting) && <LoaderCircle className="size-4 animate-spin" />}
          {submitting
            ? "Guardando reserva…"
            : uploading
              ? "Subiendo comprobante…"
              : metodoEfectivo === "recepcion"
                ? "Apartar cupo · Pagar en recepción"
                : "Confirmar pago en línea"}
          {!uploading && !submitting && <Lock className="size-4" />}
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {metodoEfectivo === "recepcion" ? (
            <>
              Tu cita quedará <strong>apartada</strong> para pagar en caja el día
              de la cita.
            </>
          ) : !puedeEnviar ? (
            "Completa el teléfono, la referencia y adjunta el comprobante."
          ) : (
            <>
              Tu cita queda <strong>en revisión</strong> hasta que la clínica
              valide el pago.
            </>
          )}
        </p>
      </div>
    </div>
  )
}