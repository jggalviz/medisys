import type { Metadata } from "next"
import Link from "next/link"

import { ShieldAlert } from "lucide-react"

import { RecepcionAdmin } from "@/components/admin/recepcion/RecepcionAdmin"

export const metadata: Metadata = {
  title: "Recepción del día | Medisys",
  robots: { index: false },
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type Props = {
  searchParams: Promise<{ tenantId?: string; date?: string }>
}

export default async function AdminRecepcionPage({ searchParams }: Props) {
  const { tenantId, date } = await searchParams
  const fechaValida = date && DATE_RE.test(date) ? date : undefined

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
            Recepción del día
          </h1>
          <p className="text-sm text-muted-foreground">
            Cola de pacientes por turno: llegadas, cobros en caja y consultas.
          </p>
        </header>

        {tenantId ? (
          <RecepcionAdmin tenantId={tenantId} initialDate={fechaValida} />
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl border border-dashed bg-card p-6 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="size-5 text-amber-600" />
              Falta el identificador de la clínica
            </p>
            <p className="text-muted-foreground">
              Abre la página con la consulta{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                ?tenantId=TU_ID_DE_CLINICA
              </code>
              . Opcionalmente incluye{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                &date=YYYY-MM-DD
              </code>{" "}
              para ver otro día.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
