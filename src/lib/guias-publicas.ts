/**
 * MEDISYS · Guías publicadas (lectura pública para landing y rutas /guias).
 *
 * Usa el cliente service_role en el servidor y filtra SIEMPRE por
 * `is_published = true`, de modo que nunca expone borradores a los visitantes.
 */
import type { GuidePage } from "@/types/database"
import { createAdminClient } from "@/lib/supabase/admin"

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

/** Guías publicadas ordenadas por categoría y orden (nunca lanza). */
export async function listarGuiasPublicas(): Promise<GuidePage[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("guide_pages")
      .select("*")
      .eq("is_published", true)
      .order("category", { ascending: true })
      .order("order_index", { ascending: true })

    if (error) return []
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapearFila)
  } catch {
    return []
  }
}

/**
 * Selecciona hasta `limite` guías destacadas: la primera de cada categoría y
 * luego las siguientes, para que la landing muestre variedad.
 */
export function guiasDestacadas(paginas: GuidePage[], limite = 6): GuidePage[] {
  const porCategoria = new Map<string, GuidePage[]>()
  for (const pagina of paginas) {
    const lista = porCategoria.get(pagina.category) ?? []
    lista.push(pagina)
    porCategoria.set(pagina.category, lista)
  }

  const destacadas: GuidePage[] = []
  let indice = 0
  while (destacadas.length < limite) {
    let agregado = false
    for (const lista of porCategoria.values()) {
      const pagina = lista[indice]
      if (!pagina) continue
      destacadas.push(pagina)
      agregado = true
      if (destacadas.length >= limite) break
    }
    if (!agregado) break
    indice += 1
  }
  return destacadas
}
