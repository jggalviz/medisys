"use server"

/**
 * MEDISYS · Guía de Uso y Configuración (Base de conocimiento).
 *
 *  - Lectura pública: `listGuidePages` / `getGuidePageBySlug` (solo publicadas).
 *  - Gestión del Super Admin: `listGuidePagesAdmin`, `getGuidePageById`,
 *    `upsertGuidePage`, `deleteGuidePage` y `subirImagenGuia` (bucket 'guides').
 */
import { revalidatePath } from "next/cache"

import type { GuidePage } from "@/types/database"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSuperAdmin } from "@/lib/super-admin"
import { asegurarBucketPublico, BUCKET_GUIDES } from "@/lib/supabase/storage"
import { slugificar } from "@/lib/slug"

export type GuideResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }

export type GuidePageInput = {
  id?: string | null
  title: string
  slug: string
  category: string
  order_index: number
  content_markdown: string
  is_published: boolean
}

function ordenar(paginas: GuidePage[]): GuidePage[] {
  return [...paginas].sort((a, b) => {
    const categoria = a.category.localeCompare(b.category, "es")
    if (categoria !== 0) return categoria
    if (a.order_index !== b.order_index) return a.order_index - b.order_index
    return a.title.localeCompare(b.title, "es")
  })
}

function mapearFila(fila: Record<string, unknown>): GuidePage {
  const texto = (valor: unknown) => (typeof valor === "string" ? valor : "")
  const numero = Number(fila.order_index)
  return {
    id: texto(fila.id),
    slug: texto(fila.slug),
    title: texto(fila.title),
    category: texto(fila.category) || "General",
    order_index: Number.isFinite(numero) ? numero : 0,
    content_markdown: texto(fila.content_markdown),
    is_published: fila.is_published !== false,
    created_at: texto(fila.created_at),
    updated_at: texto(fila.updated_at),
  }
}

async function exigirSuperAdmin(): Promise<{ ok: true } | { ok: false; message: string }> {
  const sesion = await getSuperAdmin()
  if (!sesion) return { ok: false, message: "No autorizado: requiere super admin." }
  return { ok: true }
}

/** Guías publicadas (lectura pública, respeta RLS). */
export async function listGuidePages(): Promise<GuideResult<GuidePage[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("guide_pages")
      .select("*")
      .eq("is_published", true)

    if (error) return { ok: false, message: error.message }

    const paginas = ((data ?? []) as unknown as Record<string, unknown>[]).map(mapearFila)
    return { ok: true, data: ordenar(paginas) }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al cargar la guía.",
    }
  }
}

/** Guía publicada por slug (lectura pública). */
export async function getGuidePageBySlug(
  slug: string
): Promise<GuideResult<GuidePage | null>> {
  try {
    if (!slug.trim()) return { ok: false, message: "Slug inválido." }
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("guide_pages")
      .select("*")
      .eq("slug", slug.trim())
      .eq("is_published", true)
      .maybeSingle()

    if (error) return { ok: false, message: error.message }
    return {
      ok: true,
      data: data ? mapearFila(data as unknown as Record<string, unknown>) : null,
    }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al cargar la guía.",
    }
  }
}

/** Todas las guías (incluye borradores) para el CMS del Super Admin. */
export async function listGuidePagesAdmin(): Promise<GuideResult<GuidePage[]>> {
  try {
    const acceso = await exigirSuperAdmin()
    if (!acceso.ok) return acceso

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("guide_pages")
      .select("*")
      .order("category", { ascending: true })
      .order("order_index", { ascending: true })

    if (error) return { ok: false, message: error.message }

    const paginas = ((data ?? []) as unknown as Record<string, unknown>[]).map(mapearFila)
    return { ok: true, data: paginas }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al cargar las guías.",
    }
  }
}

/** Una guía por id (incluye borradores) para el editor. */
export async function getGuidePageById(
  id: string
): Promise<GuideResult<GuidePage | null>> {
  try {
    const acceso = await exigirSuperAdmin()
    if (!acceso.ok) return acceso
    if (!id.trim()) return { ok: false, message: "Falta el identificador." }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("guide_pages")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (error) return { ok: false, message: error.message }
    return {
      ok: true,
      data: data ? mapearFila(data as unknown as Record<string, unknown>) : null,
    }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al cargar la guía.",
    }
  }
}

/** Crea o actualiza una guía (solo Super Admin). */
export async function upsertGuidePage(
  input: GuidePageInput
): Promise<GuideResult<{ id: string; slug: string }>> {
  try {
    const acceso = await exigirSuperAdmin()
    if (!acceso.ok) return acceso

    const title = input.title?.trim()
    if (!title) return { ok: false, message: "El título es obligatorio." }

    const slug = slugificar(input.slug?.trim() || title)
    if (!slug) return { ok: false, message: "El slug no es válido." }

    const category = input.category?.trim() || "General"
    const orderIndex = Number.isFinite(Number(input.order_index))
      ? Math.max(0, Math.floor(Number(input.order_index)))
      : 0

    const supabase = createAdminClient()
    const payload = {
      title,
      slug,
      category,
      order_index: orderIndex,
      content_markdown: input.content_markdown ?? "",
      is_published: Boolean(input.is_published),
    }

    if (input.id) {
      const { data, error } = await supabase
        .from("guide_pages")
        .update(payload)
        .eq("id", input.id)
        .select("id, slug")
        .maybeSingle()
      if (error) return { ok: false, message: error.message }
      if (!data) return { ok: false, message: "No se encontró la guía a actualizar." }
      revalidarGuia(data.slug)
      return { ok: true, data: { id: data.id, slug: data.slug } }
    }

    const { data, error } = await supabase
      .from("guide_pages")
      .insert({ ...payload })
      .select("id, slug")
      .maybeSingle()
    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        return { ok: false, message: `El slug "${slug}" ya está en uso.` }
      }
      return { ok: false, message: error.message }
    }
    if (!data) return { ok: false, message: "No se pudo crear la guía." }

    revalidarGuia(data.slug)
    return { ok: true, data: { id: data.id, slug: data.slug } }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al guardar la guía.",
    }
  }
}

/** Elimina una guía (solo Super Admin). */
export async function deleteGuidePage(
  id: string
): Promise<GuideResult<{ id: string }>> {
  try {
    const acceso = await exigirSuperAdmin()
    if (!acceso.ok) return acceso
    if (!id.trim()) return { ok: false, message: "Falta el identificador." }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("guide_pages")
      .delete()
      .eq("id", id)
      .select("id, slug")
      .maybeSingle()

    if (error) return { ok: false, message: error.message }
    if (!data) return { ok: false, message: "No se encontró la guía." }

    revalidarGuia(data.slug)
    return { ok: true, data: { id: data.id } }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al eliminar la guía.",
    }
  }
}

function revalidarGuia(slug: string) {
  revalidatePath("/super-admin/guias")
  revalidatePath("/[clinicSlug]/admin/guia", "page")
  revalidatePath(`/guia/${slug}`)
}

/**
 * Sube una imagen para intercalar en el contenido (bucket público 'guides').
 * Devuelve la URL pública para insertar `![descripción](url)` en el editor.
 */
export async function subirImagenGuia(
  formData: FormData
): Promise<GuideResult<{ url: string }>> {
  try {
    const acceso = await exigirSuperAdmin()
    if (!acceso.ok) return acceso

    const file = formData.get("imagen")
    if (!(file instanceof File)) return { ok: false, message: "Selecciona una imagen." }
    if (!file.type.startsWith("image/")) {
      return { ok: false, message: "El archivo debe ser una imagen." }
    }
    if (file.size > 5 * 1024 * 1024) {
      return { ok: false, message: "La imagen debe pesar menos de 5 MB." }
    }

    const bucket = await asegurarBucketPublico(BUCKET_GUIDES)
    if (!bucket.ok) return { ok: false, message: bucket.message }

    const extension = (file.name.split(".").pop() || "png")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
    const bytes = new Uint8Array(await file.arrayBuffer())

    const supabase = createAdminClient()
    const subida = await supabase.storage.from(BUCKET_GUIDES).upload(path, bytes, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    })
    if (subida.error) return { ok: false, message: subida.error.message }

    const { data } = supabase.storage.from(BUCKET_GUIDES).getPublicUrl(path)
    return { ok: true, data: { url: data.publicUrl } }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al subir la imagen.",
    }
  }
}
