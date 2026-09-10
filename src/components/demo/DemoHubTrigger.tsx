"use client"

/**
 * DemoHubTrigger · Botón que abre el Demo Hub global desde cualquier sitio.
 * Solo llama a `openDemoHub()` del contexto; no renderiza el modal.
 */
import { useDemoHub } from "@/context/DemoHubContext"
import { cn } from "@/lib/utils"

type Props = {
  label: string
  className?: string
}

export function DemoHubTrigger({ label, className }: Props) {
  const { openDemoHub } = useDemoHub()

  return (
    <button
      type="button"
      onClick={openDemoHub}
      aria-haspopup="dialog"
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700",
        className
      )}
    >
      <span aria-hidden="true">🧪</span>
      {label}
    </button>
  )
}
