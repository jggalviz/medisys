import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { BookingWizard } from "@/components/booking/BookingWizard"
import { getTenantBySlug } from "@/app/actions/tenant"
import { logoMostrable } from "@/lib/branding"

/**
 * Página pública de reserva: lee la configuración actual de la clínica
 * (p. ej. `pago_movil_enabled` y `datos_pago_movil`) en cada petición, sin
 * cachear el render del Server Component.
 */
export const dynamic = "force-dynamic"

type ReservarPageProps = {
  params: Promise<{ clinicSlug: string }>
}

/**
 * Página pública de reserva Multi-Tenant.
 * URL: /[clinicSlug]/reservar (ej. https://medisys.com.ve/clinica-demo/reservar).
 *
 * Resuelve la clínica activa por slug y despliega el BookingWizard
 * (Paciente → Especialidad → Turno → Pago) con el tenant ya inyectado.
 */
export async function generateMetadata({
  params,
}: ReservarPageProps): Promise<Metadata> {
  const { clinicSlug } = await params
  const tenant = await getTenantBySlug(clinicSlug)

  if (!tenant) {
    return {
      title: "Clínica no encontrada | Medisys",
      robots: { index: false },
    }
  }

  return {
    title: `Reservar cita en ${tenant.nombre} | Medisys`,
    description: `Agenda tu cita médica en ${tenant.nombre}. Elige especialidad, turno y paga con Pago Móvil o en recepción desde tu teléfono.`,
    openGraph: {
      title: `Reservar cita en ${tenant.nombre} | Medisys`,
      description: "Agenda y paga tu cita médica en minutos.",
      ...(logoMostrable(tenant.logo_url)
        ? { images: [logoMostrable(tenant.logo_url) as string] }
        : {}),
    },
  }
}

export default async function ReservarPage({ params }: ReservarPageProps) {
  const { clinicSlug } = await params
  const tenant = await getTenantBySlug(clinicSlug)

  if (!tenant) {
    notFound()
  }

  return <BookingWizard tenant={tenant} />
}
