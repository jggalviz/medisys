"use client"

/**
 * MEDISYS · Acciones del header según el estado de sesión.
 * ---------------------------------------------------------------
 * La landing es estática (ISR), así que este componente cliente resuelve la
 * sesión con `GET /api/sesion` (una sola petición, compartida por todas las
 * instancias del header) y pinta:
 *
 *   - **Mientras se verifica**: un placeholder del MISMO tamaño que el estado
 *     final (sin saltos de layout ni contenido equivocado → sin FOUC).
 *   - **Invitado**: "Iniciar sesión", "Crear cuenta gratis" (verde institucional)
 *     y "Entornos DEMO".
 *   - **Autenticado**: "Ir a mi Escritorio" (destino por rol) + menú de usuario
 *     con nombre, rol, perfil, configuración y cierre de sesión.
 *
 * Se usa dos veces en el Navbar (barra de escritorio y menú móvil); la promesa
 * de sesión a nivel de módulo evita una segunda petición.
 */
import { useEffect, useState } from "react"
import Link from "next/link"
import { FlaskConical, LayoutDashboard, LogIn, LogOut, UserPlus } from "lucide-react"

import { cerrarSesion } from "@/app/actions/sesion"
import { useDemoHub } from "@/context/DemoHubContext"
import { ICONO_ACCION, UserMenu } from "@/components/ui/user-menu"
import { invalidarSesionHeader, pedirSesionHeader } from "@/lib/sesion-cliente"
import { cn } from "@/lib/utils"
import type { SesionHeader } from "@/lib/destinos-sesion"

/*
 * Estilos de botón: `px-4 py-2` normalizado para que el texto respire y los
 * iconos queden alineados (todos comparten `h-10` + `gap-2`).
 */

/** Botón principal (verde institucional `#00a896` / `#028090`). */
const BOTON_PRIMARIO =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-linear-to-r from-[#00a896] to-[#028090] px-4 py-2 text-sm font-semibold leading-none whitespace-nowrap text-white shadow-sm shadow-[#028090]/25 transition hover:brightness-105"

/** Botón secundario / enlace de sesión. */
const BOTON_NEUTRO =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold leading-none whitespace-nowrap text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"

/** Botón del hub de demos. */
const BOTON_DEMO =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold leading-none whitespace-nowrap text-white shadow-sm transition-colors hover:bg-zinc-700"

/**
 * Variante compacta del botón de demos para laptops pequeñas (lg–xl): solo el
 * icono, para que la barra nunca desborde. Se expande a partir de `xl`.
 */
const BOTON_DEMO_COMPACTO =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-base leading-none text-white shadow-sm transition-colors hover:bg-zinc-700 xl:hidden"

/** Base de los botones del menú móvil (ancho completo y más altos). */
const BOTON_MOVIL =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-base font-semibold leading-none"

type Props = {
  /** `escritorio` → barra superior; `movil` → bloque del menú hamburguesa. */
  variante?: "escritorio" | "movil"
  /** Se llama al navegar (para cerrar el menú móvil). */
  onNavegar?: () => void
}

export function HeaderAuthActions({
  variante = "escritorio",
  onNavegar,
}: Props) {
  const { openDemoHub } = useDemoHub()
  const [sesion, setSesion] = useState<SesionHeader | null>(null)
  const [verificando, setVerificando] = useState(true)

  useEffect(() => {
    let activo = true
    pedirSesionHeader().then((resuelta) => {
      if (!activo) return
      setSesion(resuelta)
      setVerificando(false)
    })
    return () => {
      activo = false
    }
  }, [])

  const esMovil = variante === "movil"

  /* ---------- Invitado ---------- */
  const invitado = (
    <>
      <Link
        href="/registro?modo=login"
        onClick={onNavegar}
        className={
          esMovil
            ? cn(BOTON_MOVIL, "border border-zinc-200 bg-white text-zinc-700")
            : BOTON_NEUTRO
        }
      >
        <LogIn className="size-4" aria-hidden="true" />
        Iniciar sesión
      </Link>
      <Link
        href="/registro"
        onClick={onNavegar}
        className={
          esMovil
            ? cn(
                BOTON_MOVIL,
                "bg-linear-to-r from-[#00a896] to-[#028090] text-white"
              )
            : BOTON_PRIMARIO
        }
      >
        <UserPlus className="size-4" aria-hidden="true" />
        Crear cuenta gratis
      </Link>
      <button
        type="button"
        onClick={() => {
          onNavegar?.()
          openDemoHub()
        }}
        aria-haspopup="dialog"
        className={
          esMovil
            ? cn(BOTON_MOVIL, "bg-zinc-900 text-white")
            : cn(BOTON_DEMO, "hidden xl:inline-flex")
        }
      >
        <FlaskConical className="size-4" aria-hidden="true" />
        Entornos DEMO
      </button>

      {/* En laptops pequeñas (lg–xl) el título largo no cabe: botón compacto */}
      {!esMovil && (
        <button
          type="button"
          onClick={openDemoHub}
          aria-haspopup="dialog"
          aria-label="Entornos DEMO"
          title="Explorar los entornos DEMO"
          className={BOTON_DEMO_COMPACTO}
        >
          <span aria-hidden="true">🧪</span>
        </button>
      )}
    </>
  )

  /* ---------- Autenticado ---------- */
  const bloqueAutenticado = sesion
    ? esMovil
      ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#00a896] to-[#028090] text-sm font-bold text-white"
            >
              {sesion.iniciales}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-semibold text-zinc-900">
                {sesion.nombre}
              </span>
              <span className="truncate text-xs text-zinc-500">
                {sesion.rolLabel}
                {sesion.contexto ? ` · ${sesion.contexto}` : ""}
              </span>
            </div>
          </div>

          <Link
            href={sesion.escritorio}
            onClick={onNavegar}
            className={cn(
              BOTON_MOVIL,
              "bg-linear-to-r from-[#00a896] to-[#028090] text-white"
            )}
          >
            <LayoutDashboard className="size-4" aria-hidden="true" />
            {sesion.escritorioLabel}
          </Link>

          <nav aria-label="Acciones de la cuenta" className="flex flex-col">
            {sesion.acciones.map((accion) => {
              const Icono = ICONO_ACCION[accion.icono]
              return (
                <Link
                  key={`${accion.href}-${accion.etiqueta}`}
                  href={accion.href}
                  onClick={onNavegar}
                  className="flex h-11 items-center gap-2.5 rounded-xl px-1 text-base font-medium text-zinc-700 transition-colors hover:bg-white"
                >
                  <Icono
                    className="size-4 shrink-0 text-zinc-400"
                    aria-hidden="true"
                  />
                  {accion.etiqueta}
                </Link>
              )
            })}
          </nav>

          <form
            action={cerrarSesion}
            onSubmit={() => {
              invalidarSesionHeader()
              onNavegar?.()
            }}
          >
            <button
              type="submit"
              className={cn(
                BOTON_MOVIL,
                "border border-zinc-200 bg-white text-red-600"
              )}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Cerrar sesión
            </button>
          </form>
        </div>
      )
      : (
        <>
          <Link href={sesion.escritorio} className={BOTON_PRIMARIO}>
            <LayoutDashboard className="size-4" aria-hidden="true" />
            {sesion.escritorioLabel}
          </Link>
          <UserMenu sesion={sesion} />
        </>
      )
    : null

  /* ---------- Verificando sesión ---------- */
  // Placeholder con las MISMAS medidas que el estado final: cuando llega la
  // respuesta el hueco no cambia de tamaño (ni se muestra contenido erróneo),
  // así que no hay parpadeo ni salto de layout.
  if (verificando) {
    return esMovil ? (
      <div className="flex flex-col gap-2" aria-hidden="true">
        <span className="h-12 w-full animate-pulse rounded-xl bg-zinc-100" />
        <span className="h-12 w-full animate-pulse rounded-xl bg-zinc-100" />
        <span className="h-12 w-full animate-pulse rounded-xl bg-zinc-100" />
      </div>
    ) : (
      <div className="hidden items-center gap-3 lg:flex" aria-hidden="true">
        <span className="h-10 w-28 animate-pulse rounded-lg bg-zinc-100" />
        <span className="h-10 w-40 animate-pulse rounded-lg bg-zinc-100" />
        {/* Coincide con el botón DEMO: compacto en lg y con etiqueta en xl */}
        <span className="h-10 w-10 animate-pulse rounded-lg bg-zinc-100 xl:w-40" />
      </div>
    )
  }

  const contenido = sesion ? bloqueAutenticado : invitado

  return esMovil ? (
    <div className="flex flex-col gap-2">{contenido}</div>
  ) : (
    <div className="hidden items-center gap-3 lg:flex">{contenido}</div>
  )
}
