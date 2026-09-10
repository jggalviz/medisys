/**
 * MEDISYS · Slugs y rutas de la clínica de demostración.
 *
 * Cambiar solo `DEMO_CLINIC_SLUG` para apuntar la landing a otro tenant.
 */
export const DEMO_CLINIC_SLUG = "clinica-demo"

/** Tenant de demostración del Plan Pro (especialista independiente). */
export const DEMO_INDEPENDENT_SLUG = "medico-pro-demo"

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

/** Credenciales del especialista demo del Plan Clínica. */
export const DEMO_ESPECIALISTA = {
  cedula: "12345678",
  telefono: "04121234567",
} as const

/** Credenciales del especialista demo del Plan Pro (independiente). */
export const DEMO_ESPECIALISTA_INDEPENDIENTE = {
  cedula: "87654321",
  telefono: "04147654321",
} as const
