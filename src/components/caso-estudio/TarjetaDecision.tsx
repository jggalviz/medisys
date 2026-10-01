import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { CheckCircle2, Scale } from "lucide-react"

import { ListaChecks } from "@/components/caso-estudio/piezas"

/**
 * Bloque de una decisión de arquitectura, con el formato que usan los
 * documentos de diseño: contexto → decisión → motivos → compromiso asumido.
 * El compromiso se muestra siempre: una decisión sin costo declarado sugiere
 * que nadie la evaluó.
 */
export function TarjetaDecision({
  numero,
  icon: Icon,
  titulo,
  decision,
  porque,
  compromiso,
  children,
}: {
  numero: string
  icon: LucideIcon
  titulo: string
  decision: string
  porque: readonly string[]
  compromiso: string
  children?: ReactNode
}) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-teal-700">
          Decisión {numero}
        </span>
        <Icon className="size-4 text-zinc-400" aria-hidden="true" />
      </div>

      <h3 className="mt-3 text-xl font-bold tracking-tight text-zinc-900">
        {titulo}
      </h3>

      <p className="mt-3 border-l-2 border-teal-400 pl-4 text-sm font-medium leading-6 text-zinc-800">
        {decision}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Por qué
          </p>
          <ListaChecks items={porque} icon={CheckCircle2} className="mt-3" />
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <p className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
            <Scale className="size-3.5" aria-hidden="true" />
            Compromiso asumido
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-700">{compromiso}</p>
        </div>
      </div>

      {children ? <div className="mt-6">{children}</div> : null}
    </article>
  )
}
