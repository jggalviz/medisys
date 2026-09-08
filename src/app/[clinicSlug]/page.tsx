import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"

import { getTenantBySlug } from "@/app/actions/tenant"

type ClinicRootPageProps = {
  params: Promise<{ clinicSlug: string }>
}

/**
 * Raíz de la clínica: /[clinicSlug] valida el tenant activo y redirige al
 * wizard de reserva en /[clinicSlug]/reservar (mantiene compatibilidad con
 * enlaces antiguos como /clinica-demo o /santa-ines).
 */
export const metadata: Metadata = {
  title: "Redirigiendo a la reserva | Medisys",
  robots: { index: false },
}

export default async function ClinicRootPage({ params }: ClinicRootPageProps) {
  const { clinicSlug } = await params
  const tenant = await getTenantBySlug(clinicSlug)

  if (!tenant) {
    notFound()
  }

  redirect(`/${clinicSlug}/reservar`)
}
