import { notFound } from "next/navigation"
import Link from "next/link"
import type { Metadata } from "next"

import { getGuidePageBySlug, listGuidePages } from "@/app/actions/guides"
import { getSuperAdmin } from "@/lib/super-admin"
import { textoPlanoMarkdown } from "@/lib/markdown"
import { CentroAyuda } from "@/components/admin/guia/CentroAyuda"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const resultado = await getGuidePageBySlug(slug)
  if (!resultado.ok || !resultado.data) {
    return { title: "Guía no encontrada | Medisys", robots: { index: false } }
  }
  const extracto = textoPlanoMarkdown(resultado.data.content_markdown).slice(0, 160)
  return {
    title: `${resultado.data.title} | Centro de Ayuda Medisys`,
    description: extracto,
  }
}

export default async function GuiaPublicaPage({ params }: Props) {
  const { slug } = await params
  const guia = await getGuidePageBySlug(slug)
  if (!guia.ok || !guia.data) notFound()

  const [guias, superAdmin] = await Promise.all([listGuidePages(), getSuperAdmin()])
  const paginas = guias.ok ? guias.data : []

  return (
    <main className="min-h-dvh bg-muted/30">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href="/guias"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Volver al Centro de Ayuda
        </Link>

        <header className="mt-3 flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{guia.data.title}</h1>
          <p className="text-sm text-muted-foreground">
            Categoría: {guia.data.category} · Guía oficial de Medisys
          </p>
        </header>

        <div className="mt-6">
          <CentroAyuda
            paginas={paginas}
            canEdit={Boolean(superAdmin)}
            slugInicial={slug}
          />
        </div>
      </div>
    </main>
  )
}
