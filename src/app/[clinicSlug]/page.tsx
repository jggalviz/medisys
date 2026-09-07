import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { createClient } from "@/lib/supabase/server"
import { BookingWizard } from "@/components/booking/BookingWizard"

type ClinicPageProps = {
  params: Promise<{ clinicSlug: string }>
}

/**
 * Página pública Multi-Tenant de la clínica.
 * URL directa de reserva: /[clinicSlug] (ej. https://medisys.com.ve/clinica-demo).
 *
 * Carga la info pública del tenant (nombre, logo, datos_pago_movil) y
 * despliega el BookingWizard (Paciente → Especialidad → Fecha/hora → Pago).
 */
export async function generateMetadata({
  params,
}: ClinicPageProps): Promise<Metadata> {
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
    description: `Agenda tu cita médica en ${tenant.nombre}. Elige especialista, día y hora y paga con Pago Móvil desde tu teléfono.`,
    openGraph: {
      title: `Reservar cita en ${tenant.nombre} | Medisys`,
      description: "Agenda y paga tu cita médica en minutos.",
      ...(tenant.logo_url ? { images: [tenant.logo_url] } : {}),
    },
  }
}

export default async function ClinicPage({ params }: ClinicPageProps) {
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
