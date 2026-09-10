import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { PortalLoginForm } from "@/components/portales/PortalLoginForm"
import { getTenantBySlug } from "@/app/actions/tenant"
import { getPortalSession } from "@/lib/portal-session"

type Props = { params: Promise<{ clinicSlug: string }> }

export default async function PacienteLoginPage({ params }: Props) {
  const { clinicSlug } = await params
  const tenant = await getTenantBySlug(clinicSlug)
  if (!tenant) notFound()

  const sesion = await getPortalSession()
  if (sesion?.rol === "paciente" && sesion.tenant_id === tenant.id) {
    redirect(`/${clinicSlug}/paciente/expediente`)
  }

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
        rol="paciente"
        titulo="Portal del Paciente"
        descripcion={`Consulta tus citas, historial médico y pagos en ${tenant.nombre}.`}
        rutaDestino="/paciente/expediente"
        datosDemo={{ cedula: "87654321", telefono: "04147654321" }}
      />
    </main>
  )
}
