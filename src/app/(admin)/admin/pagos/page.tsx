import type { Metadata } from "next"
import Link from "next/link"

import { ShieldAlert } from "lucide-react"

import { PagosVerificacion } from "@/components/admin/pagos/PagosVerificacion"

export const metadata: Metadata = {
  title: "Verificación de pagos | Medisys",
  robots: { index: false },
}

type Props = {
  searchParams: Promise<{ tenantId?: string }>
}

export default async function AdminPagosPage({ searchParams }: Props) {
  const { tenantId } = await searchParams

  return (
    <main className="min-h-dvh bg-muted/30">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-col gap-1">
          <Link
            href="/"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Volver al inicio
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Verificación de pagos
          </h1>
          <p className="text-sm text-muted-foreground">
            Comprobantes recibidos por Pago Móvil en línea que la recepción debe
            validar.
          </p>
        </header>

        {tenantId ? (
          <PagosVerificacion tenantId={tenantId} />
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl border border-dashed bg-card p-6 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="size-5 text-amber-600" />
              Falta el identificador de la clínica
            </p>
            <p className="text-muted-foreground">
              Esta vista necesita el id del tenant. Abre la página con la
              consulta{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                ?tenantId=TU_ID_DE_CLINICA
              </code>
              , por ejemplo:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                /admin/pagos?tenantId=00000000-0000-0000-0000-000000000000
              </code>
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
