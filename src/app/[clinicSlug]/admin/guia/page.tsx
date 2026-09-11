import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"

import { createClient } from "@/lib/supabase/server"
import { getStaffForSlug } from "@/lib/staff"
import { getSuperAdmin } from "@/lib/super-admin"
import { getTenantBySlug } from "@/app/actions/tenant"
import { listGuidePages } from "@/app/actions/guides"
import { CentroAyuda } from "@/components/admin/guia/CentroAyuda"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Centro de Ayuda | Medisys",
  robots: { index: false },
}

type Props = { params: Promise<{ clinicSlug: string }> }

export default async function GuiaPage({ params }: Props) {
  const { clinicSlug } = await params
  const tenant = await getTenantBySlug(clinicSlug)
  if (!tenant) notFound()

  const supabase = await createClient()
  const staff = await getStaffForSlug(supabase, clinicSlug)
  if (!staff) redirect(`/${clinicSlug}/login`)

  const [guias, superAdmin] = await Promise.all([listGuidePages(), getSuperAdmin()])
  const paginas = guias.ok ? guias.data : []

  return (
    <main className="min-h-dvh bg-muted/30">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href={`/${clinicSlug}/admin`}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Volver al panel
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Guía de Uso y Configuración
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manual paso a paso para configurar {tenant.nombre} y aprovechar todas
          las funciones de Medisys.
        </p>

        <div className="mt-6">
          <CentroAyuda paginas={paginas} canEdit={Boolean(superAdmin)} />
        </div>
      </div>
    </main>
  )
}
