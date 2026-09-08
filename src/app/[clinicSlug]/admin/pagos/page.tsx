import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"

import { PagosVerificacion } from "@/components/admin/pagos/PagosVerificacion"
import { getTenantBySlug } from "@/app/actions/tenant"

export const metadata: Metadata = {
  title: "Verificación de pagos | Medisys",
  robots: { index: false },
}

type Props = {
  params: Promise<{ clinicSlug: string }>
}

export default async function AdminPagosPage({ params }: Props) {
  const { clinicSlug } = await params
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
            Verificación de pagos
          </h1>
          <p className="text-sm text-muted-foreground">
            Comprobantes recibidos por Pago Móvil en línea que la recepción debe
            validar · {tenant.nombre}
          </p>
        </header>

        <PagosVerificacion tenantId={tenant.id} />
      </div>
    </main>
  )
}
