import Link from "next/link"
import { ArrowRight, BookOpen, Search } from "lucide-react"

import type { GuidePage } from "@/types/database"
import { guiasDestacadas } from "@/lib/guias-publicas"
import { textoPlanoMarkdown } from "@/lib/markdown"

/** Extracto corto del contenido markdown para las tarjetas. */
function extracto(pagina: GuidePage, maximo = 120): string {
  const texto = textoPlanoMarkdown(pagina.content_markdown)
  if (texto.length <= maximo) return texto
  return `${texto.slice(0, maximo).trimEnd()}…`
}

/**
 * Bloque de landing "Conoce cómo funciona la plataforma": buscador rápido,
 * grid de guías destacadas por categoría y CTA al Centro de Ayuda.
 */
export function GuiasSection({ guias }: { guias: GuidePage[] }) {
  if (guias.length === 0) return null

  const destacadas = guiasDestacadas(guias, 6)
  const categorias = Array.from(new Set(guias.map((g) => g.category)))

  return (
    <section id="conocimiento" className="scroll-mt-20 border-t border-zinc-100">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-700">
            <BookOpen className="size-3.5" aria-hidden="true" />
            Centro de Ayuda
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Conoce cómo funciona la plataforma
          </h2>
          <p className="mt-3 text-base leading-7 text-zinc-600">
            Manuales paso a paso sobre configuración, operación y finanzas.
            Explora {guias.length} guías agrupadas en {categorias.length}{" "}
            categorías antes de empezar.
          </p>
        </div>

        {/* Buscador rápido → /guias?q= */}
        <form
          action="/guias"
          method="get"
          role="search"
          className="mx-auto mt-8 flex w-full max-w-xl items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm"
        >
          <label className="flex flex-1 items-center gap-2 px-2">
            <Search className="size-4 shrink-0 text-zinc-400" aria-hidden="true" />
            <input
              type="search"
              name="q"
              placeholder="Busca «pago móvil», «branding», «recepcion»…"
              aria-label="Buscar en las guías"
              className="h-10 w-full bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-10 shrink-0 items-center rounded-xl bg-linear-to-r from-teal-600 to-cyan-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            Buscar
          </button>
        </form>

        {/* Grid de guías destacadas */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {destacadas.map((pagina) => (
            <Link
              key={pagina.id}
              href={`/guias/${pagina.slug}`}
              className="group flex h-full flex-col rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-teal-200 hover:shadow-xl hover:shadow-teal-900/5"
            >
              <span className="w-fit rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                {pagina.category}
              </span>
              <h3 className="mt-4 text-base font-bold leading-snug text-zinc-900 group-hover:text-teal-700">
                {pagina.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-zinc-600">
                {extracto(pagina)}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700">
                Leer guía
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            href="/guias"
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-zinc-900 px-6 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Explorar Centro de Ayuda y Manuales →
          </Link>
        </div>
      </div>
    </section>
  )
}
