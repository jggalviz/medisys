"use client"

/**
 * Botón «Descargar Comprobante» + tarjeta visual del recibo.
 *
 * La tarjeta se renderiza fuera de pantalla (para que `html2canvas` pueda
 * capturarla) y se exporta como PDF con `jsPDF`. No requiere ninguna imagen
 * de la clínica: usa branding textual + logo opcional del tenant.
 */
import { useRef, useState } from "react"
import { LoaderCircle } from "lucide-react"

import type { Appointment, Doctor, Profile, Tenant } from "@/types/database"
import { doctorNombre, formatUSD, perfilNombre } from "@/lib/format"
import { turnoLabel } from "@/lib/whatsapp"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  tenant: Tenant
  patient: Profile
  doctor: Doctor
  appointment: Appointment
}

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente_validacion: "Pago en revisión",
  pago_en_recepcion: "Pago en recepción",
  confirmada: "Confirmada",
  en_espera: "En espera",
  en_consulta: "En consulta",
  atendido: "Atendido",
  completada: "Completada",
}

function etiquetaEstado(estado: Appointment["estado"]): string {
  return ETIQUETA_ESTADO[estado] ?? estado
}

function fechaLegibleCita(fechaHora: string): string {
  const fecha = fechaHora.slice(0, 10)
  const hora = fechaHora.length >= 16 ? fechaHora.slice(11, 16) : ""
  if (!fecha) return "Por confirmar"
  const [y, m, d] = fecha.split("-").map(Number)
  const date = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1, 12)
  const fechaFormateada = new Intl.DateTimeFormat("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
  return hora ? `${fechaFormateada} · ${hora}` : fechaFormateada
}

function metodoPagoLinea(appointment: Appointment): string {
  if (appointment.estado === "pago_en_recepcion") return "Pagar en recepción"
  if (appointment.estado === "pendiente_validacion") {
    return appointment.referencia_pago
      ? `Pago Móvil en línea · Ref. ${appointment.referencia_pago}`
      : "Pago Móvil en línea"
  }
  if (appointment.payment_method === "efectivo") return "Efectivo"
  if (appointment.payment_method === "punto") return "Punto de Venta"
  if (appointment.payment_method === "pago_movil") return "Pago Móvil"
  return "—"
}

const ESTADO_BADGE: Record<string, string> = {
  pendiente_validacion: "bg-[#fef3c7] text-[#92400e]",
  pago_en_recepcion: "bg-[#e0f2fe] text-[#075985]",
  confirmada: "bg-[#d1fae5] text-[#065f46]",
  en_espera: "bg-[#e0f2fe] text-[#075985]",
  en_consulta: "bg-[#e0e7ff] text-[#3730a3]",
  atendido: "bg-[#e4e4e7] text-[#3f3f46]",
  completada: "bg-[#e4e4e7] text-[#3f3f46]",
}

export function ReceiptDownload({
  tenant,
  patient,
  doctor,
  appointment,
}: Props) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)

  const costo =
    doctor.precio_consulta > 0
      ? `${formatUSD(doctor.precio_consulta)} USD`
      : null
  const codigo = appointment.id.slice(0, 8).toUpperCase()
  const emision = new Date().toLocaleDateString("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  async function descargarRecibo() {
    if (generating) return
    setGenerating(true)
    setError(null)

    try {
      const node = cardRef.current
      if (!node) throw new Error("No se pudo generar el recibo.")

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ])

      const canvas = await html2canvas(node, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
        // Limpia el árbol clonado para que html2canvas NO intente parsear
        // variables CSS globales de Tailwind v4 (oklch()/lab()).
        onclone: (documentClone) => {
          const html = documentClone.documentElement
          html.removeAttribute("class")
          html.setAttribute(
            "style",
            "background:#ffffff;color:#000000;margin:0;padding:0;"
          )

          const body = documentClone.body
          if (body) {
            body.removeAttribute("class")
            body.setAttribute(
              "style",
              "background:#ffffff;color:#000000;margin:0;padding:0;"
            )
          }

          const clonTarjeta = documentClone.getElementById("medisys-receipt-card")
          if (clonTarjeta) {
            clonTarjeta.removeAttribute("class")
            clonTarjeta.setAttribute(
              "style",
              "position:relative;left:0;top:0;width:400px;background:#ffffff;color:#000000;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;"
            )
          }
        },
      })

      const imgData = canvas.toDataURL("image/jpeg", 0.95)
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "l" : "p",
        unit: "px",
        format: [canvas.width, canvas.height],
        hotfixes: ["px_scaling"],
      })
      pdf.addImage(imgData, "JPEG", 0, 0, canvas.width, canvas.height)
      pdf.save(`medisys-recibo-${codigo.toLowerCase()}.pdf`)
    } catch (cause) {
      const mensaje =
        cause instanceof Error ? cause.message : "Error al generar el PDF."
      setError(mensaje)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <Button
        type="button"
        onClick={() => void descargarRecibo()}
        disabled={generating}
        className="h-12 w-full gap-2 rounded-xl text-base"
      >
        {generating && <LoaderCircle className="size-4 animate-spin" />}
        {generating ? "Generando PDF…" : "Descargar Recibo 📄"}
      </Button>
      {error && (
        <p className="text-center text-xs text-destructive">{error}</p>
      )}

            {/* Tarjeta visual capturada por html2canvas (fija fuera de pantalla). */}
      <div
        id="medisys-receipt-card"
        ref={cardRef}
        aria-hidden="true"
        style={{ color: "#18181b", backgroundColor: "#ffffff" }}
        className="pointer-events-none fixed -left-[2000px] top-0 z-[-1] w-[400px]"
      >
        <div className="border-b-4 border-[#0d9488] px-6 pb-4 pt-6">
          <div className="flex items-center gap-3">
            {tenant.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- Logo del tenant en el recibo
              <img
                src={tenant.logo_url}
                alt={`Logo de ${tenant.nombre}`}
                className="size-11 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-11 items-center justify-center rounded-full bg-[#0d9488] text-sm font-bold text-white">
                {tenant.nombre.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div>
              <p className="text-base font-extrabold leading-tight">
                {tenant.nombre}
              </p>
              <p className="text-xs text-[#71717a]">
                Comprobante de cita · Medisys
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-[#71717a]">Código de reserva</p>
              <p className="font-mono text-lg font-bold text-[#0f766e]">
                {codigo}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                ESTADO_BADGE[appointment.estado] ??
                  "bg-[#e4e4e7] text-[#3f3f46]"
              )}
            >
              {etiquetaEstado(appointment.estado)}
            </span>
          </div>

          <dl className="flex flex-col gap-1 text-sm">
            <Fila label="Fecha de emisión" valor={emision} />
            <Fila label="Paciente" valor={perfilNombre(patient)} />
            <Fila label="Especialista" valor={doctorNombre(doctor)} />
            <Fila label="Especialidad" valor={doctor.especialidad} />
            <Fila
              label="Fecha y turno"
              valor={`${fechaLegibleCita(appointment.fecha_hora)} · ${turnoLabel(
                appointment.turno
              )}`}
            />
            <Fila label="Forma de pago" valor={metodoPagoLinea(appointment)} />
          </dl>

          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm font-semibold">Costo de la consulta</span>
            <span className="text-base font-extrabold text-[#0f766e]">
              {costo ?? "Por confirmar"}
            </span>
          </div>
        </div>

        <div className="bg-[#fafafa] px-6 py-4">
          <p className="text-[11px] leading-5 text-[#71717a]">
            {tenant.nombre} · {tenant.telefono ?? ""} · {tenant.direccion ?? ""}
            {"\n"}Generado por Medisys (Vortex Logic Microsystems) ·{" "}
            {new Date().toLocaleTimeString("es-VE", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    </div>
  )
}

function Fila({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-[#e4e4e7] py-1 last:border-0">
      <dt className="text-xs uppercase tracking-wide text-[#71717a]">
        {label}
      </dt>
      <dd className="text-right font-medium text-[#18181b]">{valor}</dd>
    </div>
  )
}