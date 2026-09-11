/**
 * MEDISYS · Renderizador Markdown mínimo (sin dependencias externas).
 *
 * Soporta: encabezados (#..######), párrafos, listas (viñetas y numeradas),
 * tablas, notas/citas (>), imágenes, enlaces, **negrita**, *cursiva* y código
 * inline/bloques ```.
 *
 * Seguridad: el texto de entrada se ESCAPA primero, por lo que el HTML crudo
 * del markdown nunca se interpreta (no hay XSS). Solo se permiten URLs
 * `http(s)` o rutas internas (`/...`).
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

/** Escapa caracteres peligrosos de HTML. */
export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (caracter) => ESCAPES[caracter] ?? caracter)
}

/** ¿La URL es segura para usar en `href`/`src`? */
function urlSegura(url: string): string | null {
  const limpio = url.trim().replace(/^<|>$/g, "")
  if (/^https?:\/\//i.test(limpio) || limpio.startsWith("/")) return limpio
  return null
}

/** Aplica el formato en línea (imágenes, enlaces, negrita, cursiva, código). */
export function formatearInline(texto: string): string {
  let salida = escaparHtml(texto)

  // Imágenes: ![alt](url)
  salida = salida.replace(
    /!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (original, alt: string, url: string) => {
      const destino = urlSegura(url)
      if (!destino) return escaparHtml(original)
      return `<img src="${destino}" alt="${alt}" loading="lazy" class="my-4 max-w-full rounded-xl border" />`
    }
  )

  // Enlaces: [texto](url)
  salida = salida.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (original, etiqueta: string, url: string) => {
      const destino = urlSegura(url)
      if (!destino) return escaparHtml(original)
      return `<a href="${destino}" target="_blank" rel="noopener noreferrer" class="font-medium text-[var(--primary-color,#0284C7)] underline underline-offset-2">${etiqueta}</a>`
    }
  )

  // Negrita, cursiva y código inline.
  salida = salida.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  salida = salida.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
  salida = salida.replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.85em] dark:bg-zinc-800">$1</code>'
  )

  return salida
}

const FILA_SEPARADORA = /^\s*\|?[\s:|-]+\|[\s:|-]*$/
const ENCABEZADO = /^(#{1,6})\s+(.*)$/
const VINETA = /^\s*[-*+]\s+(.*)$/
const NUMERADA = /^\s*\d+[.)]\s+(.*)$/
const CITA = /^\s*>\s?(.*)$/

function esFilaTabla(linea: string): boolean {
  return linea.includes("|") && linea.trim().startsWith("|")
}

function celdas(linea: string): string[] {
  return linea
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((celda) => celda.trim())
}

function tablaAHTML(encabezado: string[], filas: string[][]): string {
  const th = encabezado
    .map(
      (celda) =>
        `<th class="border-b bg-muted/60 px-3 py-2 text-left font-semibold">${formatearInline(celda)}</th>`
    )
    .join("")
  const tbody = filas
    .map(
      (fila) =>
        `<tr>${fila
          .map(
            (celda) => `<td class="border-b px-3 py-2">${formatearInline(celda)}</td>`
          )
          .join("")}</tr>`
    )
    .join("")
  return `<div class="my-4 overflow-x-auto rounded-xl border"><table class="w-full text-sm"><thead><tr>${th}</tr></thead><tbody>${tbody}</tbody></table></div>`
}

/**
 * Convierte Markdown a HTML seguro. El contenido resultante puede inyectarse
 * con `dangerouslySetInnerHTML` (todos los textos están escapados).
 */
export function renderMarkdown(markdown: string): string {
  const lineas = (markdown ?? "").replace(/\r\n?/g, "\n").split("\n")
  const salida: string[] = []
  let parrafo: string[] = []
  let listaVineta: string[] = []
  let listaNumerada: string[] = []
  let cita: string[] = []
  let enCodigo = false
  let codigo: string[] = []

  const bloqueCodigo = (contenido: string[]) =>
    `<pre class="my-4 overflow-x-auto rounded-xl border bg-zinc-950 p-3 text-xs text-zinc-100"><code>${contenido.join(
      "\n"
    )}</code></pre>`

  const cerrarParrafo = () => {
    if (parrafo.length > 0) {
      salida.push(`<p class="my-3 leading-relaxed">${formatearInline(parrafo.join(" "))}</p>`)
      parrafo = []
    }
  }
  const cerrarListas = () => {
    if (listaVineta.length > 0) {
      salida.push(
        `<ul class="my-3 list-disc space-y-1 pl-5">${listaVineta
          .map((item) => `<li>${formatearInline(item)}</li>`)
          .join("")}</ul>`
      )
      listaVineta = []
    }
    if (listaNumerada.length > 0) {
      salida.push(
        `<ol class="my-3 list-decimal space-y-1 pl-5">${listaNumerada
          .map((item) => `<li>${formatearInline(item)}</li>`)
          .join("")}</ol>`
      )
      listaNumerada = []
    }
  }
  const cerrarCita = () => {
    if (cita.length > 0) {
      salida.push(
        `<blockquote class="my-4 rounded-xl border-l-4 border-[var(--primary-color,#0284C7)] bg-muted/50 px-4 py-3 text-sm">${formatearInline(
          cita.join(" ")
        )}</blockquote>`
      )
      cita = []
    }
  }
  const cerrarTodo = () => {
    cerrarParrafo()
    cerrarListas()
    cerrarCita()
  }

  for (let i = 0; i < lineas.length; i += 1) {
    const linea = lineas[i]

    // Bloques de código ```
    if (/^\s*```/.test(linea)) {
      if (enCodigo) {
        salida.push(bloqueCodigo(codigo))
        codigo = []
        enCodigo = false
      } else {
        cerrarTodo()
        enCodigo = true
      }
      continue
    }
    if (enCodigo) {
      codigo.push(escaparHtml(linea))
      continue
    }

    // Tablas (encabezado + línea separadora)
    if (
      esFilaTabla(linea) &&
      i + 1 < lineas.length &&
      FILA_SEPARADORA.test(lineas[i + 1])
    ) {
      cerrarTodo()
      const encabezado = celdas(linea)
      const filas: string[][] = []
      i += 2
      while (i < lineas.length && esFilaTabla(lineas[i])) {
        filas.push(celdas(lineas[i]))
        i += 1
      }
      i -= 1
      salida.push(tablaAHTML(encabezado, filas))
      continue
    }

    // Encabezados
    const encabezadoMatch = linea.match(ENCABEZADO)
    if (encabezadoMatch) {
      cerrarTodo()
      const nivel = encabezadoMatch[1].length
      const tamanos = ["text-3xl", "text-2xl", "text-xl", "text-lg", "text-base", "text-sm"]
      salida.push(
        `<h${nivel} class="mt-6 mb-2 font-bold tracking-tight ${
          tamanos[nivel - 1] ?? "text-base"
        }">${formatearInline(encabezadoMatch[2])}</h${nivel}>`
      )
      continue
    }

    // Citas / notas
    const citaMatch = linea.match(CITA)
    if (citaMatch) {
      cerrarParrafo()
      cerrarListas()
      cita.push(citaMatch[1])
      continue
    }
    cerrarCita()

    // Línea vacía: cierra bloques
    if (linea.trim() === "") {
      cerrarParrafo()
      cerrarListas()
      continue
    }

    // Listas
    const vinetaMatch = linea.match(VINETA)
    if (vinetaMatch) {
      cerrarParrafo()
      listaVineta.push(vinetaMatch[1])
      continue
    }
    const numeradaMatch = linea.match(NUMERADA)
    if (numeradaMatch) {
      cerrarParrafo()
      listaNumerada.push(numeradaMatch[1])
      continue
    }
    cerrarListas()

    // Separador horizontal
    if (/^\s*([-*_])\1{2,}\s*$/.test(linea)) {
      cerrarParrafo()
      salida.push('<hr class="my-6 border-dashed" />')
      continue
    }

    parrafo.push(linea.trim())
  }

  if (enCodigo && codigo.length > 0) salida.push(bloqueCodigo(codigo))
  cerrarTodo()

  return salida.join("\n")
}

/** Texto plano del markdown (para búsqueda y resúmenes). */
export function textoPlanoMarkdown(markdown: string): string {
  return (markdown ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1 ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1 ")
    .replace(/[#>*_`|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
