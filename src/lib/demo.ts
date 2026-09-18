/**
 * MEDISYS · Slugs y rutas de la clínica de demostración.
 *
 * Cambiar solo `DEMO_CLINIC_SLUG` para apuntar la landing a otro tenant.
 */
export const DEMO_CLINIC_SLUG = "clinica-demo"

/** Tenant de demostración del Plan Pro (especialista independiente). */
export const DEMO_INDEPENDENT_SLUG = "medico-pro-demo"

/**
 * Slugs de los tenants de demostración.
 *
 * Ambos comparten las mismas credenciales de staff (`DEMO_CREDENCIALES`), por
 * lo que su login (`/[clinicSlug]/login`) muestra el callout con los datos de
 * prueba y el botón de autocompletado:
 *  - `clinica-demo`    → clínica multi-especialista (tier PRO por cupo).
 *  - `medico-pro-demo` → consultorio de un solo especialista (Plan Individual).
 */
export const DEMO_TENANT_SLUGS = [
  DEMO_CLINIC_SLUG,
  DEMO_INDEPENDENT_SLUG,
] as const

/**
 * `true` si el slug corresponde a un tenant DEMO.
 * Se usa para mostrar el bloque de credenciales en el login del panel.
 */
export function esTenantDemo(slug: string | null | undefined): boolean {
  if (!slug) return false
  return (DEMO_TENANT_SLUGS as readonly string[]).includes(slug)
}

/** Experiencia del paciente (wizard de reserva). */
export const RESERVAR_DEMO_ROUTE = `/${DEMO_CLINIC_SLUG}/reservar`

/** Experiencia operativa (panel admin). */
export const ADMIN_DEMO_ROUTE = `/${DEMO_CLINIC_SLUG}/admin`

/** Reserva del Plan Pro (médico independiente, 3 pasos). */
export const RESERVAR_INDEPENDIENTE_ROUTE = `/${DEMO_INDEPENDENT_SLUG}`

/**
 * Credenciales de acceso de la demo.
 * La contraseña debe cumplir la política de Supabase Auth (mínimo 6 caracteres).
 * Se muestran en el callout del login y en el botón de autocompletado.
 */
export const DEMO_CREDENCIALES = {
  email: "demo1@demo.com",
  password: "demo123456",
} as const

/** Credenciales del especialista demo del tenant multi-especialista. */
export const DEMO_ESPECIALISTA = {
  cedula: "12345678",
  telefono: "04121234567",
} as const

/** Credenciales del especialista demo del Plan Pro (independiente). */
export const DEMO_ESPECIALISTA_INDEPENDIENTE = {
  cedula: "87654321",
  telefono: "04147654321",
} as const
