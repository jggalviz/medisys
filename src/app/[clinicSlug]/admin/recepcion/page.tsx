import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"

import { RecepcionAdmin } from "@/components/admin/recepcion/RecepcionAdmin"
import { getTenantBySlug } from "@/app/actions/tenant"

export const metadata: Metadata = {
  title: "Recepción del día | Medisys",
  robots: { index: false },
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type Props = {
  params: Promise<{ clinicSlug: string }>
  searchParams: Promise<{ date?: string }>
}

export default async function AdminRecepcionPage({
  params,
  searchParams,
}: Props) {
  const { clinicSlug } = await params
  const { date } = await searchParams
  const fechaValida = date && DATE_RE.test(date) ? date : undefined

  const tenant = await getTenantBySlug(clinicSlug)
  if (!tenant) {
    notFound()
  }

  return (
    <main className="min-h-dvh bg-muted/30">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-col gap-1">
          <Link
            href={`/${clinicSlug}/admin`}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Panel de {tenant.nombre}
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Recepción del día
          </h1>
          <p className="text-sm text-muted-foreground">
            Cola de pacientes por turno · {tenant.nombre}
          </p>
        </header>

        <RecepcionAdmin tenantId={tenant.id} initialDate={fechaValida} />
      </div>
    </main>
  )
}
