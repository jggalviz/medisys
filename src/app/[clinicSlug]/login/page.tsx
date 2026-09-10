import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"

import { LoginForm } from "@/components/auth/LoginForm"
import { getTenantBySlug } from "@/app/actions/tenant"
import { DEMO_CLINIC_SLUG } from "@/lib/demo"
import { logoMostrable } from "@/lib/branding"

type LoginPageProps = {
  params: Promise<{ clinicSlug: string }>
}

export async function generateMetadata({
  params,
}: LoginPageProps): Promise<Metadata> {
  const { clinicSlug } = await params
  const tenant = await getTenantBySlug(clinicSlug)

  return {
    title: tenant
      ? `Iniciar sesión · ${tenant.nombre} | Medisys`
      : "Clínica no encontrada | Medisys",
    robots: { index: false },
  }
}

export default async function LoginPage({ params }: LoginPageProps) {
  const { clinicSlug } = await params
  const tenant = await getTenantBySlug(clinicSlug)

  if (!tenant) {
    notFound()
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-10">
      <Link
        href={`/${clinicSlug}/reservar`}
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Volver a la página de reserva
      </Link>

      <LoginForm
        clinicSlug={tenant.slug}
        tenantNombre={tenant.nombre}
        tenantLogoUrl={logoMostrable(tenant.logo_url)}
        esDemo={tenant.slug === DEMO_CLINIC_SLUG}
      />
    </main>
  )
}
