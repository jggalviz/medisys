"use client"

/**
 * Editor del CMS de guías (Super Admin).
 * Markdown enriquecido + subida de imágenes (bucket 'guides') + vista previa.
 */
import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Bold,
  Code,
  Eye,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  LoaderCircle,
  Quote,
  Save,
  Table as TableIcon,
  Trash2,
} from "lucide-react"

import {
  deleteGuidePage,
  subirImagenGuia,
  upsertGuidePage,
} from "@/app/actions/guides"
import type { GuidePage } from "@/types/database"
import { slugificar } from "@/lib/slug"
import { MarkdownView } from "@/components/guia/MarkdownView"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type Props = {
  inicial: GuidePage | null
  categorias: string[]
}

/** Estilo compartido de los botones de la barra de herramientas. */
const BOTON_TOOL =
  "inline-flex size-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"

export function GuiaEditor({ inicial, categorias }: Props) {
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const inputImagenRef = useRef<HTMLInputElement | null>(null)

  const [title, setTitle] = useState(inicial?.title ?? "")
  const [slug, setSlug] = useState(inicial?.slug ?? "")
  const [slugManual, setSlugManual] = useState(Boolean(inicial?.slug))
  const [category, setCategory] = useState(inicial?.category ?? "Primeros Pasos")
  const [orderIndex, setOrderIndex] = useState(String(inicial?.order_index ?? 1))
  const [published, setPublished] = useState(inicial?.is_published ?? true)
  const [contenido, setContenido] = useState(inicial?.content_markdown ?? "")
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null)
  const [mostrarPreview, setMostrarPreview] = useState(true)
  const [guardando, startGuardando] = useTransition()
  const [subiendo, setSubiendo] = useState(false)

  const slugFinal = slugManual ? slug : slugificar(title)

  function insertar(antes: string, despues = "", placeholder = "") {
    const area = textareaRef.current
    if (!area) {
      setContenido((prev) => `${prev}${antes}${placeholder}${despues}`)
      return
    }
    const inicio = area.selectionStart ?? contenido.length
    const fin = area.selectionEnd ?? contenido.length
    const seleccion = contenido.slice(inicio, fin) || placeholder
    const siguiente = `${contenido.slice(0, inicio)}${antes}${seleccion}${despues}${contenido.slice(fin)}`
    setContenido(siguiente)

    // Reposiciona el cursor alrededor del texto insertado.
    window.requestAnimationFrame(() => {
      area.focus()
      const posicion = inicio + antes.length + seleccion.length
      area.setSelectionRange(posicion, posicion)
    })
  }

  async function seleccionarImagen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setSubiendo(true)
    const formData = new FormData()
    formData.append("imagen", file)
    const resultado = await subirImagenGuia(formData)
    setSubiendo(false)

    if (!resultado.ok) {
      setMensaje({ tipo: "error", texto: resultado.message })
      return
    }
    const descripcion = file.name.replace(/\.[^.]+$/, "")
    insertar(`\n![${descripcion}](${resultado.data.url})\n`)
    setMensaje({ tipo: "ok", texto: "Imagen subida e insertada en el contenido." })
  }

  function guardar() {
    if (guardando) return
    setMensaje(null)
    startGuardando(async () => {
      const resultado = await upsertGuidePage({
        id: inicial?.id ?? null,
        title,
        slug: slugFinal,
        category,
        order_index: Number(orderIndex) || 0,
        content_markdown: contenido,
        is_published: published,
      })

      if (!resultado.ok) {
        setMensaje({ tipo: "error", texto: resultado.message })
        return
      }
      setMensaje({ tipo: "ok", texto: "Guía guardada ✓" })
      router.push("/super-admin/guias")
      router.refresh()
    })
  }

  function eliminar() {
    if (!inicial) return
    const confirmado = window.confirm(
      `¿Eliminar la guía "${inicial.title}"? Esta acción no se puede deshacer.`
    )
    if (!confirmado) return

    startGuardando(async () => {
      const resultado = await deleteGuidePage(inicial.id)
      if (!resultado.ok) {
        setMensaje({ tipo: "error", texto: resultado.message })
        return
      }
      router.push("/super-admin/guias")
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/super-admin/guias"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver a las guías
        </Link>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => setMostrarPreview((prev) => !prev)}
          >
            <Eye className="size-4" />
            {mostrarPreview ? "Ocultar vista previa" : "Vista previa"}
          </Button>
          {inicial && (
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              disabled={guardando}
              onClick={eliminar}
            >
              <Trash2 className="size-4" />
              Eliminar
            </Button>
          )}
          <Button
            type="button"
            className="gap-2"
            disabled={guardando || subiendo || !title.trim()}
            onClick={guardar}
          >
            {guardando ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {guardando ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>

      <h1 className="text-lg font-bold tracking-tight">
        {inicial ? "Editar guía" : "Nueva guía"}
      </h1>

      {/* Metadatos */}
      <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="guia-title">Título *</Label>
          <Input
            id="guia-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej.: Branding y logo de la clínica"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="guia-slug">Slug (URL)</Label>
          <Input
            id="guia-slug"
            value={slugFinal}
            onChange={(e) => {
              setSlugManual(true)
              setSlug(e.target.value)
            }}
            className="font-mono text-xs"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="guia-category">Categoría</Label>
          <Input
            id="guia-category"
            list="categorias-guia"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Primeros Pasos, Personalización, Finanzas…"
          />
          <datalist id="categorias-guia">
            {categorias.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="guia-order">Orden</Label>
          <Input
            id="guia-order"
            value={orderIndex}
            inputMode="numeric"
            onChange={(e) => setOrderIndex(e.target.value.replace(/\D/g, ""))}
            className="w-24"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={published}
            aria-label="Publicar guía"
            onClick={() => setPublished((prev) => !prev)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
              published ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
            )}
          >
            <span
              className={cn(
                "inline-block size-4 rounded-full bg-white shadow transition-transform",
                published ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
          <span className="text-sm font-medium">
            {published ? "Publicada" : "Borrador (solo Super Admin)"}
          </span>
        </div>
      </section>

      {/* Editor + vista previa */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              title="Encabezado"
              aria-label="Encabezado"
              onClick={() => insertar("## ", "", "Título de sección")}
              className={BOTON_TOOL}
            >
              <Heading2 className="size-4" />
            </button>
            <button
              type="button"
              title="Negrita"
              aria-label="Negrita"
              onClick={() => insertar("**", "**", "texto")}
              className={BOTON_TOOL}
            >
              <Bold className="size-4" />
            </button>
            <button
              type="button"
              title="Cursiva"
              aria-label="Cursiva"
              onClick={() => insertar("*", "*", "texto")}
              className={BOTON_TOOL}
            >
              <Italic className="size-4" />
            </button>
            <button
              type="button"
              title="Lista"
              aria-label="Lista"
              onClick={() => insertar("\n- ", "", "Elemento")}
              className={BOTON_TOOL}
            >
              <List className="size-4" />
            </button>
            <button
              type="button"
              title="Lista numerada"
              aria-label="Lista numerada"
              onClick={() => insertar("\n1. ", "", "Primer paso")}
              className={BOTON_TOOL}
            >
              <ListOrdered className="size-4" />
            </button>
            <button
              type="button"
              title="Nota destacada"
              aria-label="Nota destacada"
              onClick={() => insertar("\n> **Nota:** ", "", "detalle importante")}
              className={BOTON_TOOL}
            >
              <Quote className="size-4" />
            </button>
            <button
              type="button"
              title="Código inline"
              aria-label="Código inline"
              onClick={() => insertar("`", "`", "código")}
              className={BOTON_TOOL}
            >
              <Code className="size-4" />
            </button>
            <button
              type="button"
              title="Enlace"
              aria-label="Enlace"
              onClick={() => insertar("[", "](https://)", "texto del enlace")}
              className={BOTON_TOOL}
            >
              <Link2 className="size-4" />
            </button>
            <button
              type="button"
              title="Tabla"
              aria-label="Tabla"
              onClick={() =>
                insertar("\n| Columna | Uso |\n| --- | --- |\n| Ejemplo | Descripción |\n")
              }
              className={BOTON_TOOL}
            >
              <TableIcon className="size-4" />
            </button>
            <button
              type="button"
              title="Insertar imagen"
              aria-label="Insertar imagen"
              disabled={subiendo}
              onClick={() => inputImagenRef.current?.click()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-60"
            >
              {subiendo ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <ImageIcon className="size-4" />
              )}
              Imagen
            </button>
            <input
              ref={inputImagenRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={seleccionarImagen}
            />
          </div>

          <textarea
            ref={textareaRef}
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            spellCheck={false}
            placeholder={"# Título de la guía\n\nEscribe el contenido en Markdown…"}
            className="min-h-[420px] flex-1 rounded-xl border border-input bg-transparent p-3 font-mono text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>

        <div
          className={cn(
            "flex flex-col gap-2 rounded-2xl border bg-card p-4",
            !mostrarPreview && "hidden lg:flex"
          )}
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Vista previa en vivo
          </span>
          <div className="max-h-[520px] overflow-y-auto rounded-xl border bg-background p-4">
            {contenido.trim() ? (
              <MarkdownView markdown={contenido} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Escribe el contenido para ver la vista previa.
              </p>
            )}
          </div>
        </div>
      </section>

      {mensaje && (
        <p
          role={mensaje.tipo === "error" ? "alert" : "status"}
          className={cn(
            "rounded-xl border px-3 py-2 text-sm",
            mensaje.tipo === "ok"
              ? "border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          {mensaje.texto}
        </p>
      )}
    </div>
  )
}
