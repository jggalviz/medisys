/**
 * MEDISYS · Prueba gratuita por volumen (primeras 10 reservas).
 *
 * Módulo PURO (servidor + cliente): la misma promesa comercial que muestra la
 * landing (`/`), el formulario de registro (`/registro`) y el aviso de
 * bienvenida del panel se leen desde aquí, para no duplicar textos ni números.
 *
 * El contador vive en `tenants.reservas_consumidas` (migración 0021), arranca
 * en 0 al crear la cuenta y `tenants.reservas_gratis_limite` guarda el cupo.
 */
import type { PlanTenant } from "@/types/database"

/** Reservas incluidas sin pago en la prueba (todos los planes). */
export const RESERVAS_GRATIS_LIMITE = 10

/** Promesa de valor mostrada en el registro y en el panel. */
export const MENSAJE_PRUEBA_GRATIS =
  "Prueba gratis - Primeras 10 reservas incluidas sin compromiso"

/**
 * Banner del selector de planes del registro: la prueba por volumen aplica a
 * los 3 planes (no hay uno "sin prueba" ni uno que cueste más al inicio).
 */
export const MENSAJE_PRUEBA_TODOS_PLANES =
  "Todos los planes incluyen las primeras 10 reservas gratis para probar el servicio"

/**
 * Plan preseleccionado en el alta (`/registro`): PyME, el tier marcado como
 * "Recomendado" en la landing y en el selector de planes. El usuario puede
 * cambiarlo antes de enviar el formulario; el cupo inicial de especialistas y la
 * normalización al rango del tier viven en `@/lib/suscripcion`
 * (`cupoInicialRegistro`).
 */
export const PLAN_REGISTRO_POR_DEFECTO: PlanTenant = "PYME"

export type ConsumoPrueba = {
  /** Reservas ya creadas desde el alta. */
  consumidas: number
  /** Reservas incluidas sin pago. */
  limite: number
  /** Reservas incluidas que quedan disponibles. */
  restantes: number
  /** Ya se consumieron todas las reservas incluidas. */
  agotada: boolean
}

/**
 * Normaliza el contador y el cupo leídos de la fila del tenant (tolerante a
 * `null`, textos de PostgREST o instalaciones sin la migración 0021).
 */
export function consumoPrueba(
  reservasConsumidas: unknown,
  limite?: unknown
): ConsumoPrueba {
  const cupoBruto = Math.floor(Number(limite))
  const cupo =
    Number.isFinite(cupoBruto) && cupoBruto > 0
      ? cupoBruto
      : RESERVAS_GRATIS_LIMITE

  const consumidasBruto = Math.floor(Number(reservasConsumidas))
  const consumidas =
    Number.isFinite(consumidasBruto) && consumidasBruto > 0
      ? consumidasBruto
      : 0

  return {
    consumidas,
    limite: cupo,
    restantes: Math.max(0, cupo - consumidas),
    agotada: consumidas >= cupo,
  }
}
