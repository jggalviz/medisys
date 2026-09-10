import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { PortalLoginForm } from "@/components/portales/PortalLoginForm"
import { getTenantBySlug } from "@/app/actions/tenant"
import { getCredencialesDemoPortal } from "@/app/actions/portal-auth"
import { getPortalSession } from "@/lib/portal-session"

type Props = { params: Promise<{ clinicSlug: string }> }

export default async function EspecialistaLoginPage({ params }: Props) {
  const { clinicSlug } = await params
  const tenant = await getTenantBySlug(clinicSlug)
  if (!tenant) notFound()

  const sesion = await getPortalSession()
  if (sesion?.rol === "especialista" && sesion.tenant_id === tenant.id) {
    redirect(`/${clinicSlug}/especialista/dashboard`)
  }

  // Datos DEMO del tenant actual (primer especialista activo). Sirven de
  // respaldo; el botón los vuelve a consultar dinámicamente al pulsarse.
  const demo = await getCredencialesDemoPortal(tenant.id, "especialista")

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-10">
      <Link
        href={`/${clinicSlug}/reservar`}
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Volver a la página de reserva
      </Link>
      <PortalLoginForm
        tenantId={tenant.id}
        clinicSlug={clinicSlug}
        rol="especialista"
        titulo="Portal del Especialista"
        descripcion={`Accede con tu cédula y teléfono para gestionar tus pacientes en ${tenant.nombre}.`}
        rutaDestino="/especialista/dashboard"
        datosDemo={
          demo.ok
            ? { cedula: demo.data.cedula, telefono: demo.data.telefono }
            : null
        }
        mostrarDemo
      />
    </main>
  )
}
