import { notFound, redirect } from "next/navigation"

import { PacientePortal } from "@/components/portales/paciente/PacientePortal"
import { getTenantBySlug } from "@/app/actions/tenant"
import { getPortalSession } from "@/lib/portal-session"

type Props = { params: Promise<{ clinicSlug: string }> }

export default async function PacienteExpedientePage({ params }: Props) {
  const { clinicSlug } = await params
  const tenant = await getTenantBySlug(clinicSlug)
  if (!tenant) notFound()

  const sesion = await getPortalSession()
  if (!sesion || sesion.rol !== "paciente" || sesion.tenant_id !== tenant.id) {
    redirect(`/${clinicSlug}/paciente/login`)
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-6">
      <PacientePortal clinicSlug={clinicSlug} />
    </main>
  )
}
