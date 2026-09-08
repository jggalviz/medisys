/**
 * MEDISYS · Slugs y rutas de la clínica de demostración.
 *
 * Cambiar solo `DEMO_CLINIC_SLUG` para apuntar la landing a otro tenant.
 */
export const DEMO_CLINIC_SLUG = "clinica-demo"

/** Experiencia del paciente (wizard de reserva). */
export const RESERVAR_DEMO_ROUTE = `/${DEMO_CLINIC_SLUG}/reservar`

/** Experiencia operativa (panel admin). */
export const ADMIN_DEMO_ROUTE = `/${DEMO_CLINIC_SLUG}/admin`

/**
 * Credenciales de acceso de la demo (seed de `0001_auth_multi_tenant.sql`).
 * Se muestran en el callout del login y en el botón de autocompletado.
 */
export const DEMO_CREDENCIALES = {
  email: "demo@demo.com",
  password: "demo",
} as const
