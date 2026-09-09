import { notFound, redirect } from "next/navigation"

import { ExpedienteEspecialista } from "@/components/portales/especialista/ExpedienteEspecialista"
import { getTenantBySlug } from "@/app/actions/tenant"
import { getPortalSession } from "@/lib/portal-session"

type Props = {
  params: Promise<{ clinicSlug: string; id: string }>
}

export default async function ExpedientePacientePage({ params }: Props) {
  const { clinicSlug, id } = await params
  const tenant = await getTenantBySlug(clinicSlug)
  if (!tenant) notFound()

  const sesion = await getPortalSession()
  if (!sesion || sesion.rol !== "especialista" || sesion.tenant_id !== tenant.id) {
    redirect(`/${clinicSlug}/especialista/login`)
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-6">
      <ExpedienteEspecialista pacienteId={id} clinicSlug={clinicSlug} />
    </main>
  )
}
