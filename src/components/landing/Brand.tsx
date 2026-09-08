import { HeartPulse } from "lucide-react"

import { cn } from "@/lib/utils"

/** Logo Medisys reutilizable (landing, wizard y recibos). */
export function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-teal-500 to-cyan-600 text-white shadow-md shadow-teal-600/20">
        <HeartPulse className="size-5" aria-hidden="true" strokeWidth={2.2} />
      </span>
      <span
        className={cn(
          "text-lg font-bold tracking-tight",
          inverted ? "text-white" : "text-zinc-900"
        )}
      >
        Medisys
      </span>
    </span>
  )
}
