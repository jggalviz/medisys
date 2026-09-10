import { getInfoRenovacion } from "@/app/actions/suscripcion"
import { RenovarMembresia } from "@/components/admin/suscripcion/RenovarMembresia"
import { getTenantBySlug } from "@/app/actions/tenant"
import { createClient } from "@/lib/supabase/server"
import { getStaffForSlug } from "@/lib/staff"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import { ShieldAlert } from "lucide-react"

export const metadata: Metadata = {
  title: "Renovar membresía | Medisys",
  robots: { index: false },
}

type Props = {
  params: Promise<{ clinicSlug: string }>
}

export default async function RenovarMembresiaPage({ params }: Props) {
  const { clinicSlug } = await params
  const tenant = await getTenantBySlug(clinicSlug)
  if (!tenant) notFound()

  const supabase = await createClient()
  const staff = await getStaffForSlug(supabase, clinicSlug)
  if (!staff) redirect(`/${clinicSlug}/login`)

  const info = await getInfoRenovacion(tenant.id)

  return (
    <main className="min-h-dvh bg-muted/30">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Link
          href={`/${clinicSlug}/admin`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Volver al panel
        </Link>

        {staff.role !== "admin" ? (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card p-8 text-center">
            <ShieldAlert className="size-8 text-amber-600" />
            <p className="text-lg font-semibold">Acceso restringido</p>
            <p className="text-sm text-muted-foreground">
              Solo el administrador de la clínica puede renovar la membresía.
            </p>
          </div>
        ) : !info.ok ? (
          <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
            {info.message}
          </div>
        ) : (
          <>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">
              Renovar membresía
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tenant.nombre} · {info.data.planLabel}
            </p>
            <div className="mt-6">
              <RenovarMembresia info={info.data} />
            </div>
          </>
        )}
      </div>
    </main>
  )
}
