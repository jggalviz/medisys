import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { createClient } from "@/lib/supabase/server"
import { BookingWizard } from "@/components/booking/BookingWizard"

type ReservarPageProps = {
  params: Promise<{ clinicSlug: string }>
}

/**
 * Página pública de reserva Multi-Tenant.
 * Cada clínica tiene su URL personalizada: /[clinicSlug]/reservar
 * (ej. https://medisys.com.ve/santa-ines/reservar).
 *
 * Carga la info pública del tenant (nombre, logo, datos_pago_movil) y
 * despliega el BookingWizard (Paciente → Médico → Fecha/hora → Pago).
 */
export async function generateMetadata({
  params,
}: ReservarPageProps): Promise<Metadata> {
  const { clinicSlug } = await params
  const supabase = await createClient()

  const { data: tenant } = await supabase
    .from("tenants")
    .select("nombre, logo_url, slug")
    .eq("slug", clinicSlug)
    .eq("is_active", true)
    .maybeSingle()

  if (!tenant) {
    return {
      title: "Clínica no encontrada | Medisys",
      robots: { index: false },
    }
  }

  return {
    title: `Reservar cita en ${tenant.nombre} | Medisys`,
    description: `Agenda tu cita médica en ${tenant.nombre}. Elige médico, día y hora y paga con Pago Móvil desde tu teléfono.`,
    openGraph: {
      title: `Reservar cita en ${tenant.nombre} | Medisys`,
      description: "Agenda y paga tu cita médica en minutos.",
      ...(tenant.logo_url ? { images: [tenant.logo_url] } : {}),
    },
  }
}

export default async function ReservarPage({ params }: ReservarPageProps) {
  const { clinicSlug } = await params
  const supabase = await createClient()

  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", clinicSlug)
    .eq("is_active", true)
    .maybeSingle()

  if (error || !tenant) {
    notFound()
  }

  return <BookingWizard tenant={tenant} />
}
