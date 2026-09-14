/**
 * MEDISYS · Categorías del Centro de Ayuda
 * -----------------------------------------
 * El contenido de las guías vive en `guide_pages` (editable por el Super
 * Admin), pero el ORDEN de las categorías es una decisión de producto: las
 * guías nuevas de los módulos fiscales deben aparecer justo después de
 * «Primeros Pasos» y antes de «Finanzas».
 *
 * Módulo puro (seguro en cliente y servidor).
 */
import type { GuidePage } from "@/types/database"

/** Categoría de los módulos de Administración, Facturación y Contabilidad. */
export const CATEGORIA_FISCAL = "Gestión Fiscal y Administrativa (Venezuela)"

/** Orden canónico del índice. Las categorías no listadas van al final. */
export const CATEGORIAS_GUIA: readonly string[] = [
  "Primeros Pasos",
  CATEGORIA_FISCAL,
  "Finanzas",
  "Operación",
  "Especialistas",
  "Personalización",
]

function normalizar(valor: string): string {
  return valor.trim().toLowerCase()
}

/** Posición de la categoría en el índice (las desconocidas, al final). */
export function posicionCategoria(categoria: string): number {
  const indice = CATEGORIAS_GUIA.findIndex(
    (item) => normalizar(item) === normalizar(categoria)
  )
  return indice === -1 ? CATEGORIAS_GUIA.length : indice
}

/** Comparador del índice: categoría canónica → orden → título. */
export function compararGuias(a: GuidePage, b: GuidePage): number {
  const posicion = posicionCategoria(a.category) - posicionCategoria(b.category)
  if (posicion !== 0) return posicion

  const categoria = a.category.localeCompare(b.category, "es")
  if (categoria !== 0) return categoria

  if (a.order_index !== b.order_index) return a.order_index - b.order_index
  return a.title.localeCompare(b.title, "es")
}

export type GrupoGuia = { categoria: string; paginas: GuidePage[] }

/** Agrupa las guías por categoría respetando el orden canónico. */
export function agruparPorCategoria(
  paginas: readonly GuidePage[]
): GrupoGuia[] {
  const grupos = new Map<string, GuidePage[]>()

  for (const pagina of paginas) {
    const lista = grupos.get(pagina.category) ?? []
    lista.push(pagina)
    grupos.set(pagina.category, lista)
  }

  return Array.from(grupos.entries())
    .map(([categoria, lista]) => ({
      categoria,
      paginas: [...lista].sort(compararGuias),
    }))
    .sort((a, b) => compararGuias(a.paginas[0], b.paginas[0]))
}

/** Guías del bloque fiscal ordenadas (atajos del Centro de Ayuda). */
export function guiasFiscales(paginas: readonly GuidePage[]): GuidePage[] {
  return paginas
    .filter(
      (pagina) => normalizar(pagina.category) === normalizar(CATEGORIA_FISCAL)
    )
    .sort(compararGuias)
}
