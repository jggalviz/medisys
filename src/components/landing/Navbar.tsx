"use client"

/**
 * Navbar principal de la landing.
 *
 * Layout pensado para no saturarse en laptops pequeñas (1024–1440 px):
 *  - **4 enlaces principales** (Beneficios · Cómo funciona · Precios · FAQ).
 *  - Los enlaces secundarios (Facturación, Centro de Ayuda) viven en el footer
 *    y se agrupan bajo "Recursos" en el menú móvil.
 *  - El menú de hamburguesa aparece antes (`lg:hidden`): en tablets y laptops
 *    pequeñas todo el contenido viaja en el menú desplegable, así los botones
 *    nunca colapsan ni se salen del viewport.
 *
 * Las acciones de la derecha las resuelve `HeaderAuthActions` según la sesión:
 *  - **Invitado** → "Iniciar sesión", "Crear cuenta gratis" y "Entornos DEMO".
 *  - **Autenticado** → "Ir a mi Escritorio" (destino según el rol) y menú de
 *    usuario con nombre, rol, perfil, configuración y cierre de sesión.
 */
import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

import { Brand } from "./Brand"
import { HeaderAuthActions } from "./HeaderAuthActions"

/** Enlaces principales: los 4 imprescindibles (evitan la saturación). */
const NAV_ITEMS = [
  { label: "Beneficios", href: "#beneficios" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Precios", href: "#precios" },
  { label: "FAQ", href: "#faq" },
] as const

/**
 * Enlaces secundarios: fuera de la barra principal para no saturarla.
 * Se muestran agrupados como "Recursos" en el menú móvil y en el footer.
 */
const NAV_RECURSOS = [
  { label: "Facturación", href: "#facturacion" },
  { label: "Centro de Ayuda", href: "#conocimiento" },
] as const

/** Estilos compartidos de los enlaces del menú móvil. */
const ENLACE_MOVIL =
  "flex h-11 items-center rounded-xl px-3 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50"

export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6 lg:px-8">
        <Link href="/" aria-label="Medisys, inicio" className="shrink-0">
          <Brand />
        </Link>

        {/* Navegación principal (solo desktop grande: 4 enlaces) */}
        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-6 lg:flex xl:gap-8"
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-950"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Acciones de sesión (lg+): invitado o autenticado */}
        <HeaderAuthActions variante="escritorio" />

        {/* Hamburguesa: aparece antes (tablets y laptops pequeñas) */}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls="menu-movil-landing"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-100 lg:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Menú desplegable (mobile · tablet · laptop pequeña) */}
      {open && (
        <div
          id="menu-movil-landing"
          className="border-t border-zinc-100 bg-white lg:hidden"
        >
          <nav
            aria-label="Navegación móvil"
            className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-6 py-4 lg:px-8"
          >
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={ENLACE_MOVIL}
              >
                {item.label}
              </a>
            ))}

            {/* Recursos: enlaces secundarios agrupados */}
            <span className="mt-2 px-3 text-[11px] font-bold uppercase tracking-wide text-zinc-400">
              Recursos
            </span>
            {NAV_RECURSOS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={ENLACE_MOVIL}
              >
                {item.label}
              </a>
            ))}

            <span className="my-3 border-t border-dashed border-zinc-200" />

            {/* Acciones de sesión (móvil): invitado o autenticado */}
            <HeaderAuthActions
              variante="movil"
              onNavegar={() => setOpen(false)}
            />
          </nav>
        </div>
      )}
    </header>
  )
}
