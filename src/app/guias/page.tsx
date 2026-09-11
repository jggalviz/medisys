import type { Metadata } from "next"
import Link from "next/link"

import { listGuidePages } from "@/app/actions/guides"
import { getSuperAdmin } from "@/lib/super-admin"
import { CentroAyuda } from "@/components/admin/guia/CentroAyuda"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Centro de Ayuda y Manuales | Medisys",
  description:
    "Guías paso a paso para configurar tu clínica: reservas, pagos, especialistas, branding y más.",
}

type Props = {
  searchParams: Promise<{ q?: string }>
}

export default async function GuiasPublicasPage({ searchParams }: Props) {
  const { q } = await searchParams
  const [guias, superAdmin] = await Promise.all([listGuidePages(), getSuperAdmin()])
  const paginas = guias.ok ? guias.data : []

  return (
    <main className="min-h-dvh bg-muted/30">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Volver al inicio
        </Link>

        <header className="mt-3 flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Centro de Ayuda y Manuales
          </h1>
          <p className="text-sm text-muted-foreground">
            Explora a fondo cómo funciona Medisys: {paginas.length} guías sobre
            configuración, operación y finanzas.
          </p>
        </header>

        <div className="mt-6">
          <CentroAyuda
            paginas={paginas}
            canEdit={Boolean(superAdmin)}
            consultaInicial={q}
          />
        </div>
      </div>
    </main>
  )
}
