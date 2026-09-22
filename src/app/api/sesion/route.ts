import { NextResponse } from "next/server"

import { getSesionHeader } from "@/lib/sesion-actual"

/**
 * GET /api/sesion
 * ---------------------------------------------------------------------------
 * Devuelve la sesión activa del visitante para el header de la landing:
 *
 *   { autenticado: false, sesion: null }
 *   { autenticado: true,  sesion: { tipo, nombre, rolLabel, escritorio, … } }
 *
 * - Nunca se cachea (`private, no-store`): es información del propio usuario.
 * - La landing sigue siendo ISR estática; este endpoint es el "hueco" dinámico
 *   que el header consulta una sola vez (ver `HeaderAuthActions`).
 * - Sin cookies de sesión responde de inmediato, sin llamar a Supabase.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  const sesion = await getSesionHeader()

  return NextResponse.json(
    { autenticado: Boolean(sesion), sesion },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      },
    }
  )
}
