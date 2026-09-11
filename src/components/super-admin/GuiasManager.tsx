"use client"

/** Lista del CMS de guías (Super Admin): organizadas por categoría y orden. */
import { useState } from "react"
import Link from "next/link"
import { FileText, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react"

import { deleteGuidePage } from "@/app/actions/guides"
import type { GuidePage } from "@/types/database"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function GuiasManager({ paginas }: { paginas: GuidePage[] }) {
  const [items, setItems] = useState<GuidePage[]>(paginas)
  const [borrando, setBorrando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const categorias = Array.from(new Set(items.map((p) => p.category)))

  async function eliminar(pagina: GuidePage) {
    const confirmado = window.confirm(
      `¿Eliminar la guía "${pagina.title}"? Esta acción no se puede deshacer.`
    )
    if (!confirmado) return

    setBorrando(pagina.id)
    const resultado = await deleteGuidePage(pagina.id)
    setBorrando(null)

    if (!resultado.ok) {
      setAviso(resultado.message)
      return
    }
    setItems((prev) => prev.filter((p) => p.id !== pagina.id))
    setAviso(`Guía "${pagina.title}" eliminada.`)
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileText className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Guía de Uso y Configuración</h1>
            <p className="text-sm text-muted-foreground">
              Crea y organiza el manual que verán las clínicas.
            </p>
          </div>
        </div>
        <Link
          href="/super-admin/guias/nueva"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          Nueva guía
        </Link>
      </header>

      {aviso && (
        <p className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300">
          {aviso}
        </p>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card px-4 py-12 text-center">
          <FileText className="size-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">Aún no hay guías</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Crea la primera página del manual para que las clínicas sepan cómo
            configurar la plataforma.
          </p>
        </div>
      ) : (
        categorias.map((categoria) => (
          <section key={categoria} className="flex flex-col gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {categoria}
            </h2>
            <ul className="overflow-hidden rounded-2xl border bg-card">
              {items
                .filter((p) => p.category === categoria)
                .sort((a, b) => a.order_index - b.order_index)
                .map((pagina, index) => (
                  <li
                    key={pagina.id}
                    className={cn(
                      "flex flex-wrap items-center gap-3 px-4 py-3",
                      index !== 0 && "border-t"
                    )}
                  >
                    <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                      {pagina.order_index}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{pagina.title}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        /{pagina.slug}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        pagina.is_published
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      )}
                    >
                      {pagina.is_published ? "Publicada" : "Borrador"}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Link
                        href={`/super-admin/guias/${pagina.id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted/50"
                      >
                        <Pencil className="size-3.5" />
                        Editar
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Eliminar ${pagina.title}`}
                        disabled={borrando === pagina.id}
                        onClick={() => void eliminar(pagina)}
                      >
                        {borrando === pagina.id ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
