import {
  ArrowUpRight,
  CalendarClock,
  ExternalLink,
  GitBranch,
  Mail,
} from "lucide-react"

import { Panel } from "@/components/caso-estudio/ui"
import {
  COMPANY_NAME,
  COMPANY_URL,
  DEMO_URL,
  GITHUB_HANDLE,
  GITHUB_URL,
  SALES_EMAIL,
  STACK,
} from "@/components/caso-estudio/constantes"

type Enlace = {
  icon: typeof GitBranch
  titulo: string
  valor: string
  href: string
  externo: boolean
}

const ENLACES: readonly Enlace[] = [
  {
    icon: GitBranch,
    titulo: "Repositorio",
    valor: GITHUB_HANDLE,
    href: GITHUB_URL,
    externo: true,
  },
  {
    icon: ExternalLink,
    titulo: "Clínica demo",
    valor: "clinica-demo/reservar",
    href: DEMO_URL,
    externo: true,
  },
  {
    icon: Mail,
    titulo: "Contacto",
    valor: SALES_EMAIL,
    href: `mailto:${SALES_EMAIL}?subject=${encodeURIComponent("Medisys · caso de estudio")}`,
    externo: false,
  },
]

/** Columna derecha del hero: stack exacto y accesos directos. */
export function FichaTecnicaHero() {
  return (
    <aside className="space-y-4">
      <Panel tone="dark">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-300">
          Ficha técnica
        </p>
        <ul className="mt-4 space-y-3">
          {STACK.map((item) => (
            <li
              key={item.nombre}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-white/5 pb-3 last:border-0 last:pb-0"
            >
              <span className="text-sm font-semibold text-white">
                {item.nombre}
              </span>
              <span className="text-xs text-zinc-400">{item.detalle}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel tone="dark">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-300">
          Enlaces directos
        </p>
        <ul className="mt-4 space-y-2">
          {ENLACES.map((enlace) => {
            const Icono = enlace.icon
            return (
              <li key={enlace.titulo}>
                <a
                  href={enlace.href}
                  {...(enlace.externo
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3.5 py-3 transition-colors hover:border-teal-400/40 hover:bg-white/5"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Icono
                      className="size-4 shrink-0 text-teal-300"
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-zinc-100">
                        {enlace.titulo}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-zinc-400">
                        {enlace.valor}
                      </span>
                    </span>
                  </span>
                  <ArrowUpRight
                    className="size-4 shrink-0 text-zinc-500 transition-colors group-hover:text-teal-300"
                    aria-hidden="true"
                  />
                </a>
              </li>
            )
          })}
        </ul>
        <p className="mt-4 flex items-center gap-2 border-t border-white/10 pt-4 text-[11px] text-zinc-500">
          <CalendarClock className="size-3.5" aria-hidden="true" />
          {COMPANY_NAME} ·{" "}
          <a
            href={COMPANY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:text-teal-300"
          >
            {COMPANY_URL.replace("https://", "")}
          </a>
        </p>
      </Panel>
    </aside>
  )
}
