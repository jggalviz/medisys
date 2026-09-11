"use client"

/**
 * Centro de Ayuda de la clínica (manual navegable).
 * Sidebar por categorías + buscador + contenido Markdown. Si el usuario en
 * sesión es `super_admin`, muestra un acceso flotante para editar la página.
 */
import { useMemo, useState } from "react"
import Link from "next/link"
import { BookOpen, Pencil, Search } from "lucide-react"

import type { GuidePage } from "@/types/database"
import { textoPlanoMarkdown } from "@/lib/markdown"
import { MarkdownView } from "@/components/guia/MarkdownView"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Props = {
  paginas: GuidePage[]
  canEdit: boolean
  /** Término de búsqueda inicial (p. ej. `?q=`). */
  consultaInicial?: string
  /** Slug de la página que debe abrirse por defecto. */
  slugInicial?: string
}

export function CentroAyuda({
  paginas,
  canEdit,
  consultaInicial,
  slugInicial,
}: Props) {
  const [consulta, setConsulta] = useState(consultaInicial?.trim() ?? "")
  const [seleccionId, setSeleccionId] = useState<string | null>(
    () =>
      paginas.find((p) => p.slug === slugInicial)?.id ?? paginas[0]?.id ?? null
  )

  const filtradas = useMemo(() => {
    const termino = consulta.trim().toLowerCase()
    if (!termino) return paginas
    return paginas.filter((pagina) => {
      const texto = [
        pagina.title,
        pagina.category,
        textoPlanoMarkdown(pagina.content_markdown),
      ]
        .join(" ")
        .toLowerCase()
      return texto.includes(termino)
    })
  }, [paginas, consulta])

  const seleccionada =
    filtradas.find((p) => p.id === seleccionId) ?? filtradas[0] ?? null

  const categorias = useMemo(
    () => Array.from(new Set(filtradas.map((p) => p.category))),
    [filtradas]
  )

  if (paginas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card px-4 py-12 text-center">
        <BookOpen className="size-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">Aún no hay guías publicadas</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          El manual de Medisys aparecerá aquí en cuanto el equipo publique las
          primeras guías.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      {/* Índice lateral */}
      <aside className="flex flex-col gap-3 lg:sticky lg:top-20 lg:self-start">
        <label className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="Buscar en la guía…"
            aria-label="Buscar en la guía"
            className="h-7 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
        </label>

        <nav className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto pr-1">
          {categorias.map((categoria) => (
            <div key={categoria} className="flex flex-col gap-1">
              <span className="px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {categoria}
              </span>
              <ul className="flex flex-col">
                {filtradas
                  .filter((p) => p.category === categoria)
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((pagina) => {
                    const activa = seleccionada?.id === pagina.id
                    return (
                      <li key={pagina.id}>
                        <button
                          type="button"
                          onClick={() => setSeleccionId(pagina.id)}
                          aria-current={activa ? "page" : undefined}
                          className={cn(
                            "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                            activa
                              ? "bg-primary/10 font-semibold text-primary"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          )}
                        >
                          {pagina.title}
                        </button>
                      </li>
                    )
                  })}
              </ul>
            </div>
          ))}
          {filtradas.length === 0 && (
            <p className="px-1 text-sm text-muted-foreground">
              Sin resultados para «{consulta}».
            </p>
          )}
        </nav>
      </aside>

      {/* Contenido */}
      <section className="min-w-0 rounded-2xl border bg-card p-5">
        {seleccionada ? (
          <>
            <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-primary">
                  {seleccionada.category}
                </span>
                <h1 className="text-xl font-bold tracking-tight">
                  {seleccionada.title}
                </h1>
              </div>
              {canEdit && (
                <Link
                  href={`/super-admin/guias/${seleccionada.id}`}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted/50"
                >
                  <Pencil className="size-3.5" />
                  Editar esta página
                </Link>
              )}
            </header>

            <article className="pt-4">
              <MarkdownView markdown={seleccionada.content_markdown} />
            </article>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Selecciona una guía del índice para ver su contenido.
          </p>
        )}
      </section>

      {/* Acceso flotante de Super Admin (modo inspección) */}
      {canEdit && seleccionada && (
        <Link
          href={`/super-admin/guias/${seleccionada.id}`}
          className="fixed bottom-6 right-6 z-50 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
        >
          <Pencil className="size-4" />
          Editar esta página
        </Link>
      )}
    </div>
  )
}
