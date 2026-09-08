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
 * Credenciales de acceso de la demo.
 * La contraseña debe cumplir la política de Supabase Auth (mínimo 6 caracteres).
 * Se muestran en el callout del login y en el botón de autocompletado.
 */
export const DEMO_CREDENCIALES = {
  email: "demo@demo.com",
  password: "demo123456",
} as const
