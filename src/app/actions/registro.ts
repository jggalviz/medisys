"use server"

/**
 * MEDISYS · Registro público de consultorios (Server Actions).
 * -----------------------------------------------------------------
 * Da de alta una cuenta completa en un solo flujo, sin intervención del Super
 * Admin (`/registro`, CTA de la landing):
 *
 *   1. Usuario administrador en Supabase Auth (la contraseña la cifra Supabase
 *      Auth con bcrypt; nunca se guarda en nuestras tablas).
 *   2. Fila en `tenants` con el slug público único (enlace de reservas), el plan
 *      elegido en el selector (`plan_type`) y su cupo inicial de especialistas
 *      (`max_especialistas`, según `cupoInicialRegistro`).
 *   3. Membresía en `tenant_users` con rol 'admin'.
 *   4. Primer registro en `doctors` (especialidad declarada en el formulario),
 *      para que el enlace de reservas funcione de inmediato.
 *   5. Contadores de la prueba gratuita en 0 (`reservas_consumidas`).
 *   6. Sesión iniciada en las cookies del navegador (login automático).
 *
 * Requiere `SUPABASE_SERVICE_ROLE_KEY` (cliente service_role): el alta se hace
 * en servidor y NUNCA se expone esa clave al navegador. Si algo falla a mitad
 * del flujo se revierte (rollback) para no dejar cuentas huérfanas.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, PlanTenant } from "@/types/database"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { cupoInicialRegistro } from "@/lib/suscripcion"
import { RESERVAS_GRATIS_LIMITE } from "@/lib/trial"
import {
  erroresPorCampo,
  partesNombre,
  registroPublicoSchema,
  type RegistroCampo,
  type RegistroInput,
} from "@/lib/validations/registro"

export type RegistroResult =
  | {
      ok: true
      slug: string
      consultorio: string
      /** Plan comercial guardado en `tenants.plan_type`. */
      plan: PlanTenant
      /** Cupo inicial de especialistas guardado en el tenant. */
      cupoEspecialistas: number
      /** `false` si la cuenta se creó pero el login automático no prosperó. */
      sesionIniciada: boolean
    }
  | {
      ok: false
      message: string
      /** Campo que originó el error (para resaltarlo en el formulario). */
      campo?: RegistroCampo
      /** Errores por campo cuando el fallo es de validación. */
      errores?: Partial<Record<RegistroCampo, string>>
    }

export type ConsultorioDisponible = {
  /** Slug que usaría el consultorio. */
  slug: string
  /** `false` si el slug (o un derivado) ya está tomado. */
  disponible: boolean
}

/** Formato de slug admitido en `tenants.slug`. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Sufijos probados al buscar un slug libre ('dr-perez', 'dr-perez-2', …). */
const MAX_INTENTOS_SLUG = 25

function limpiarSlug(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** ¿El slug está libre? (`null` = no se pudo verificar). */
async function slugLibre(
  supabase: SupabaseClient<Database>,
  slug: string
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle()

  if (error) return null
  return !data
}

/**
 * Busca un slug libre partiendo del nombre del consultorio. Si el nombre ya
 * está tomado prueba sufijos numéricos ('clinica-san-jose-2', '-3', …).
 */
async function resolverSlugUnico(
  supabase: SupabaseClient<Database>,
  base: string
): Promise<string | null> {
  const raiz = limpiarSlug(base)
  if (!raiz || !SLUG_RE.test(raiz)) return null

  for (let intento = 1; intento <= MAX_INTENTOS_SLUG; intento += 1) {
    const candidato = intento === 1 ? raiz : `${raiz}-${intento}`
    const libre = await slugLibre(supabase, candidato)
    if (libre === null) return null
    if (libre) return candidato
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Verificación en vivo del nombre del consultorio                    */
/* ------------------------------------------------------------------ */

/**
 * Comprueba si el nombre de consultorio está disponible como enlace público.
 * La usa el formulario (con debounce) para avisar antes de enviar; la
 * verificación definitiva se repite en `registrarConsultorio`.
 */
export async function verificarConsultorio(
  nombre: string
): Promise<{ ok: true; data: ConsultorioDisponible } | { ok: false; message: string }> {
  const raiz = limpiarSlug(nombre ?? "")
  if (raiz.length < 3) {
    return { ok: true, data: { slug: raiz, disponible: false } }
  }

  try {
    const supabase = createAdminClient()
    const slug = await resolverSlugUnico(supabase, raiz)
    if (!slug) {
      return {
        ok: true,
        data: { slug: raiz, disponible: false },
      }
    }
    return { ok: true, data: { slug, disponible: true } }
  } catch {
    return { ok: false, message: "No se pudo verificar el nombre del consultorio." }
  }
}

/* ------------------------------------------------------------------ */
/* Alta de la cuenta                                                  */
/* ------------------------------------------------------------------ */

/** Traduce los errores de Supabase Auth a mensajes accionables. */
function mensajeErrorAuth(
  error: { code?: string; message?: string } | null
): { message: string; campo?: RegistroCampo } {
  const codigo = String(error?.code ?? "")
  const mensaje = String(error?.message ?? "")

  if (
    codigo === "email_exists" ||
    /already|registered|exists/i.test(mensaje)
  ) {
    return {
      message:
        "El correo ya está registrado. Inicia sesión o usa otro correo electrónico.",
      campo: "email",
    }
  }
  if (codigo === "weak_password" || /password/i.test(mensaje)) {
    return {
      message: "La contraseña no cumple la política de seguridad de la cuenta.",
      campo: "password",
    }
  }
  if (codigo === "email_address_invalid" || /invalid.*email/i.test(mensaje)) {
    return {
      message: "El correo electrónico no es válido.",
      campo: "email",
    }
  }
  return {
    message: mensaje || "No se pudo crear la cuenta. Intenta de nuevo.",
  }
}

/**
 * Crea la cuenta completa del consultorio y, si es posible, deja la sesión
 * iniciada en las cookies del navegador (login automático) para que la UI
 * pueda redirigir directo al panel de bienvenida.
 */
export async function registrarConsultorio(
  input: RegistroInput
): Promise<RegistroResult> {
  const validacion = registroPublicoSchema.safeParse(input)
  if (!validacion.success) {
    const campos = erroresPorCampo(validacion.error.issues)
    return {
      ok: false,
      message: validacion.error.message,
      campo: validacion.error.issues[0]?.campo as RegistroCampo | undefined,
      errores: campos,
    }
  }

  const datos = validacion.data

  try {
    const supabase = createAdminClient()

    // 1) Slug público único a partir del nombre del consultorio.
    const slugResuelto = await resolverSlugUnico(supabase, datos.slug)
    if (!slugResuelto) {
      return {
        ok: false,
        message:
          "El nombre de consultorio no está disponible. Prueba con otro nombre.",
        campo: "consultorio",
      }
    }
    const slug: string = slugResuelto

    // 2) Usuario en Supabase Auth (bcrypt interno; la contraseña no se guarda
    //    en ninguna tabla de la aplicación).
    const { data: creado, error: errorAuth } =
      await supabase.auth.admin.createUser({
        email: datos.email,
        password: datos.password,
        email_confirm: true,
        user_metadata: {
          role: "admin",
          nombre: datos.nombre,
          telefono: datos.telefono,
          consultorio: datos.consultorio,
        },
      })

    if (errorAuth || !creado?.user) {
      return { ok: false, ...mensajeErrorAuth(errorAuth) }
    }

    const userId = creado.user.id

    /** Revierte el alta si algo falla después de crear el usuario. */
    async function rollback(): Promise<void> {
      await supabase.from("tenants").delete().eq("slug", slug)
      await supabase.auth.admin.deleteUser(userId)
    }

    // 3) Tenant (consultorio) con el plan elegido y los contadores de la prueba
    //    gratuita en 0.
    const cupoEspecialistas = cupoInicialRegistro(datos.plan)
    const payloadBase = {
      nombre: datos.consultorio,
      slug,
      // Columna real del plan comercial: `tenants.plan_type`
      // ('INDIVIDUAL' | 'PYME' | 'PRO', migración 0020).
      plan_type: datos.plan,
      max_especialistas: cupoEspecialistas,
      telefono: datos.telefono,
      logo_url: null,
      datos_pago_movil: null,
      is_active: true,
      pago_movil_enabled: true,
      // Prueba por volumen: arranca en 0 y sin fecha de vencimiento (el cobro
      // se activa al superar las reservas incluidas).
      suscripcion_vence_at: null,
    }

    const conContador = {
      ...payloadBase,
      reservas_consumidas: 0,
      reservas_gratis_limite: RESERVAS_GRATIS_LIMITE,
    }

    let { data: tenant, error: errorTenant } = await supabase
      .from("tenants")
      .insert(conContador)
      .select("id, slug")
      .maybeSingle()

    // Instalación sin la migración 0021: se crea la cuenta sin el contador en
    // lugar de bloquear el registro (el trigger/backfill lo inicializa luego).
    if (errorTenant?.code === "PGRST204") {
      const reintento = await supabase
        .from("tenants")
        .insert(payloadBase)
        .select("id, slug")
        .maybeSingle()
      tenant = reintento.data
      errorTenant = reintento.error
    }

    if (errorTenant || !tenant) {
      await supabase.auth.admin.deleteUser(userId)
      if (errorTenant?.code === "23505") {
        return {
          ok: false,
          message:
            "El nombre de consultorio no está disponible. Prueba con otro nombre.",
          campo: "consultorio",
        }
      }
      return {
        ok: false,
        message:
          errorTenant?.message ?? "No se pudo crear el consultorio. Intenta de nuevo.",
      }
    }

    // 4) Membresía admin del creador de la cuenta.
    const { error: errorMembresia } = await supabase
      .from("tenant_users")
      .insert({
        tenant_id: tenant.id,
        user_id: userId,
        role: "admin",
        precio_consulta: null,
      })

    if (errorMembresia) {
      await rollback()
      return {
        ok: false,
        message: `No se pudo asignar el rol de administrador: ${errorMembresia.message}`,
      }
    }

    // 5) Primer especialista (el propio responsable de la cuenta) para que el
    //    enlace público de reservas funcione desde el primer minuto.
    const partes = partesNombre(datos.nombre)
    const { error: errorDoctor } = await supabase.from("doctors").insert({
      tenant_id: tenant.id,
      nombres: partes.nombres,
      apellidos: partes.apellidos,
      especialidad: datos.especialidad,
      telefono: datos.telefono,
      precio_consulta: 0,
    })

    if (errorDoctor) {
      await rollback()
      return {
        ok: false,
        message: `No se pudo crear el perfil del especialista: ${errorDoctor.message}`,
      }
    }

    // 6) Login automático: escribe la sesión (cookies httpOnly) del usuario
    //    recién creado para entrar directo al panel sin volver a autenticarse.
    let sesionIniciada = false
    try {
      const supabaseSesion = await createClient()
      const { error: errorLogin } = await supabaseSesion.auth.signInWithPassword(
        { email: datos.email, password: datos.password }
      )
      sesionIniciada = !errorLogin
    } catch {
      // La cuenta ya existe: si el login automático falla, la UI envía al
      // usuario al login de su clínica.
      sesionIniciada = false
    }

    return {
      ok: true,
      slug: tenant.slug,
      consultorio: datos.consultorio,
      plan: datos.plan,
      cupoEspecialistas,
      sesionIniciada,
    }
  } catch (cause) {
    return {
      ok: false,
      message:
        cause instanceof Error
          ? cause.message
          : "No se pudo crear la cuenta. Intenta de nuevo.",
    }
  }
}
