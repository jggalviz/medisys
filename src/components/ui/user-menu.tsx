"use client"

/**
 * MEDISYS · Menú del usuario autenticado (avatar + desplegable).
 *
 * Se apoya en el primitivo `Menu` de Base UI: navegación con flechas, cierre con
 * Escape, `aria-haspopup="menu"` y foco devuelto al botón. Muestra el nombre y el
 * rol de la sesión, los enlaces de la cuenta y el cierre de sesión (un
 * formulario con Server Action, así que funciona sin JavaScript).
 */
import type { LucideIcon } from "lucide-react"
import {
  CalendarCheck,
  ChevronDown,
  CreditCard,
  Globe,
  LogOut,
  ReceiptText,
  Settings,
  UserRound,
  Users,
} from "lucide-react"
import { Menu } from "@base-ui/react/menu"

import { cerrarSesion } from "@/app/actions/sesion"
import { invalidarSesionHeader } from "@/lib/sesion-cliente"
import type { IconoAccion, SesionHeader } from "@/lib/destinos-sesion"

/** Icono de cada acción del menú. */
export const ICONO_ACCION: Record<IconoAccion, LucideIcon> = {
  perfil: UserRound,
  configuracion: Settings,
  citas: CalendarCheck,
  facturacion: ReceiptText,
  pacientes: Users,
  publico: Globe,
  suscripciones: CreditCard,
}

/** Estilos compartidos por los ítems del menú. */
export const ITEM_MENU =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-zinc-700 outline-none data-[highlighted]:bg-zinc-100 data-[highlighted]:text-zinc-900"

const ITEM_PELIGRO =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-red-600 outline-none data-[highlighted]:bg-red-50"

export function UserMenu({ sesion }: { sesion: SesionHeader }) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Cuenta de ${sesion.nombre}`}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white pl-1 pr-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 data-[popup-open]:border-zinc-300 data-[popup-open]:bg-zinc-50"
      >
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#00a896] to-[#028090] text-xs font-bold text-white"
        >
          {sesion.iniciales}
        </span>
        <span className="hidden max-w-[8.5rem] truncate lg:inline">
          {sesion.nombre}
        </span>
        <ChevronDown className="size-4 shrink-0 text-zinc-400" aria-hidden="true" />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={10} className="z-50">
          <Menu.Popup className="min-w-64 origin-top-right rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl outline-none transition-[transform,opacity] duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0">
            {/* Identidad: nombre + correo + rol + consultorio */}
            <div className="flex items-center gap-3 px-2.5 pb-2 pt-2.5">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#00a896] to-[#028090] text-sm font-bold text-white"
              >
                {sesion.iniciales}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-zinc-900">
                  {sesion.nombre}
                </span>
                {sesion.email && (
                  <span className="truncate text-xs text-zinc-500">
                    {sesion.email}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 px-2.5 pb-2.5">
              <span className="rounded-full bg-[#00a896]/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#028090]">
                {sesion.rolLabel}
              </span>
              {sesion.contexto && (
                <span className="truncate text-[11px] text-zinc-500">
                  {sesion.contexto}
                </span>
              )}
            </div>

            <Menu.Separator className="my-1 h-px bg-zinc-100" />

            {sesion.acciones.map((accion) => {
              const Icono = ICONO_ACCION[accion.icono]
              return (
                <Menu.LinkItem
                  key={`${accion.href}-${accion.etiqueta}`}
                  href={accion.href}
                  closeOnClick
                  className={ITEM_MENU}
                >
                  <Icono
                    className="size-4 shrink-0 text-zinc-400"
                    aria-hidden="true"
                  />
                  {accion.etiqueta}
                </Menu.LinkItem>
              )
            })}

            <Menu.Separator className="my-1 h-px bg-zinc-100" />

            <form action={cerrarSesion} onSubmit={invalidarSesionHeader}>
              <Menu.Item
                render={<button type="submit" />}
                nativeButton
                closeOnClick={false}
                className={ITEM_PELIGRO}
              >
                <LogOut className="size-4 shrink-0" aria-hidden="true" />
                Cerrar sesión
              </Menu.Item>
            </form>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
