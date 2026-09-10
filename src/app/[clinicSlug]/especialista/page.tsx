import { notFound, redirect } from "next/navigation"

import { getTenantBySlug } from "@/app/actions/tenant"
import { getPortalSession } from "@/lib/portal-session"

type Props = { params: Promise<{ clinicSlug: string }> }

/**
 * Acceso corto al portal del especialista: `/clinica-demo/especialista`.
 * Si hay sesión válida del rol va al dashboard; si no, al login.
 */
export default async function EspecialistaRootPage({ params }: Props) {
  const { clinicSlug } = await params
  const tenant = await getTenantBySlug(clinicSlug)
  if (!tenant) notFound()

  const sesion = await getPortalSession()
  if (sesion?.rol === "especialista" && sesion.tenant_id === tenant.id) {
    redirect(`/${clinicSlug}/especialista/dashboard`)
  }
  redirect(`/${clinicSlug}/especialista/login`)
}
