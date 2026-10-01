import Link from "next/link"
import { GitBranch, Home } from "lucide-react"

import { Brand } from "@/components/landing/Brand"
import { Container } from "@/components/caso-estudio/ui"
import { GITHUB_URL, NAV_ANCHORS } from "@/components/caso-estudio/constantes"

/**
 * Barra superior del caso de estudio: identidad + anclas de sección +
 * acceso directo al repositorio. Es `sticky` para que el evaluador pueda
 * saltar entre bloques sin perder el contexto.
 */
export function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/85 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label="Volver a la landing de Medisys">
            <Brand />
          </Link>
          <span className="hidden font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700 sm:inline">
            Caso de estudio
          </span>
        </div>

        <nav
          aria-label="Secciones del caso de estudio"
          className="hidden items-center gap-0.5 lg:flex"
        >
          {NAV_ANCHORS.map((ancla) => (
            <a
              key={ancla.id}
              href={`#${ancla.id}`}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              {ancla.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-teal-300 hover:text-teal-800"
          >
            <GitBranch className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Código fuente</span>
          </a>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            <Home className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Inicio</span>
            <span className="sr-only sm:hidden">Volver al inicio</span>
          </Link>
        </div>
      </Container>
    </header>
  )
}
