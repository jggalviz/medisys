import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"

import { ShieldAlert } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { getStaffForSlug } from "@/lib/staff"
import { getTenantBySlug } from "@/app/actions/tenant"
import { LandingManager } from "@/components/admin/landing/LandingManager"
import { normalizarLandingConfig } from "@/lib/landing"
import { getLatestBcvRate } from "@/lib/bcv"

/** Lee la sesión del admin y la landing actual en cada petición. */
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Mi Landing Page | Medisys",
  robots: { index: false },
}

type Props = {
  params: Promise<{ clinicSlug: string }>
}

export default async function LandingPageAdmin({ params }: Props) {
  const { clinicSlug } = await params
  const tenant = await getTenantBySlug(clinicSlug)
  if (!tenant) notFound()

  const supabase = await createClient()
  const staff = await getStaffForSlug(supabase, clinicSlug)
  if (!staff) redirect(`/${clinicSlug}/login`)
  if (staff.role !== "admin") {
    return (
      <main className="min-h-dvh bg-muted/30">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
          <Link
            href={`/${clinicSlug}/admin`}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Volver al panel
          </Link>
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-dashed bg-card p-8 text-center">
            <ShieldAlert className="mx-auto size-8 text-amber-600" />
            <p className="text-lg font-semibold">Acceso restringido</p>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              La edición de la Landing Page está disponible únicamente para el
              rol <strong>Administrador</strong>.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const { data: doctores } = await supabase
    .from("doctors")
    .select("precio_consulta")
    .eq("tenant_id", tenant.id)

  const precioConsultaBase =
    ((doctores ?? []) as unknown as { precio_consulta?: unknown }[])
      .map((doctor) => Number(doctor.precio_consulta))
      .find((valor) => Number.isFinite(valor) && valor > 0) ?? null

  const tasaBCV = await getLatestBcvRate(supabase)

  return (
    <main className="min-h-dvh bg-muted/30">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Link
          href={`/${clinicSlug}/admin`}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Volver al panel
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Mi Landing Page</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personaliza el perfil público de {tenant.nombre} en /{clinicSlug}.
        </p>

        <LandingManager
          tenantId={tenant.id}
          clinicSlug={clinicSlug}
          nombre={tenant.nombre}
          planType={tenant.plan_type ?? null}
          precioConsultaBase={precioConsultaBase}
          tasaBCV={tasaBCV}
          inicial={{
            enabled: tenant.landing_enabled !== false,
            config: normalizarLandingConfig(tenant.landing_config),
          }}
        />
      </div>
    </main>
  )
}
