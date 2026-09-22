"use client"

/**
 * MEDISYS · Botón "i" con popover accesible.
 *
 * Lo usa el selector de planes del registro para explicar "para quién es" cada
 * plan sin recargar la tarjeta. Comportamiento:
 *  - **Hover / puntero**: abre tras un retardo corto y cierra al salir (con una
 *    pequeña espera para poder mover el cursor dentro del popup).
 *  - **Clic / teclado**: fija el popup (Enter, Espacio o clic en el botón);
 *    Escape o un clic fuera lo cierran.
 *
 * Se apoya en el primitivo `Popover` de Base UI (`@base-ui/react/popover`), que
 * aporta el rol de diálogo, `aria-expanded`/`aria-controls`, el manejo de foco y
 * el cierre por Escape/clic externo.
 */
import { useEffect, useRef, useState } from "react"
import { Popover } from "@base-ui/react/popover"
import { Info } from "lucide-react"

import { cn } from "@/lib/utils"

/** Retardo antes de abrir con el puntero (evita parpadeos al pasar por encima). */
const RETARDO_APERTURA_MS = 120
/** Gracia para moverse del botón al popup sin que se cierre. */
const RETARDO_CIERRE_MS = 150

type Props = {
  /** Texto explicativo (cuerpo del popup). */
  children: React.ReactNode
  /** Etiqueta accesible del botón (ej. "Para quién es el Plan Individual"). */
  etiqueta: string
  /** Título opcional mostrado dentro del popup. */
  titulo?: string
  /** Lado del botón donde se coloca el popup. */
  side?: "top" | "bottom" | "left" | "right"
  className?: string
}

export function InfoPopover({
  children,
  etiqueta,
  titulo,
  side = "top",
  className,
}: Props) {
  const [abierto, setAbierto] = useState(false)
  /** `true` si el usuario lo abrió con clic o teclado (no se cierra al salir). */
  const [fijado, setFijado] = useState(false)
  const apertura = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cierre = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (apertura.current) clearTimeout(apertura.current)
      if (cierre.current) clearTimeout(cierre.current)
    },
    []
  )

  function limpiar(ref: { current: ReturnType<typeof setTimeout> | null }) {
    if (ref.current) {
      clearTimeout(ref.current)
      ref.current = null
    }
  }

  function alEntrar() {
    limpiar(cierre)
    if (abierto) return
    limpiar(apertura)
    apertura.current = setTimeout(() => setAbierto(true), RETARDO_APERTURA_MS)
  }

  function alSalir() {
    limpiar(apertura)
    if (fijado) return
    limpiar(cierre)
    cierre.current = setTimeout(() => setAbierto(false), RETARDO_CIERRE_MS)
  }

  function alCambiarEstado(nuevo: boolean) {
    limpiar(apertura)
    limpiar(cierre)
    setFijado(nuevo)
    setAbierto(nuevo)
  }

  return (
    <Popover.Root open={abierto} onOpenChange={alCambiarEstado}>
      <span
        className="inline-flex"
        onPointerEnter={alEntrar}
        onPointerLeave={alSalir}
      >
        <Popover.Trigger
          type="button"
          aria-label={etiqueta}
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-full text-muted-foreground/70 transition-colors",
            "hover:bg-[#00a896]/10 hover:text-[#028090] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a896]/40",
            className
          )}
        >
          <Info className="size-3.5" aria-hidden="true" />
        </Popover.Trigger>
      </span>

      <Popover.Portal>
        <Popover.Positioner
          side={side}
          align="center"
          sideOffset={8}
          className="z-50"
          onPointerEnter={alEntrar}
          onPointerLeave={alSalir}
        >
          <Popover.Popup
            aria-label={titulo ? undefined : etiqueta}
            className={cn(
              "max-w-[17rem] rounded-xl border bg-popover p-3 text-xs leading-5 text-popover-foreground shadow-lg",
              "transition-[transform,opacity] duration-150 focus-visible:outline-none",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0"
            )}
          >
            {titulo && (
              <Popover.Title className="mb-1 block text-[13px] font-bold text-[#028090]">
                {titulo}
              </Popover.Title>
            )}
            <Popover.Description className="block text-popover-foreground/90">
              {children}
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
