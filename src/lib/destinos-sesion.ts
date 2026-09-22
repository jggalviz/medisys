/**
 * MEDISYS · Sesión del header público: destinos, etiquetas e iniciales.
 * ---------------------------------------------------------------
 * Módulo PURO (servidor + cliente) que traduce una sesión a lo que necesita el
 * header de la landing:
 *   - el botón principal ("Ir a mi Escritorio") con la primera pantalla útil
 *     del rol,
 *   - los enlaces del menú desplegable (perfil, configuración…),
 *   - las etiquetas legibles y las iniciales del avatar.
 *
 * Todas las rutas apuntan a pantallas que existen en el producto, de modo que
 * el header nunca lleva a un 404 ni a una pantalla restringida.
 */
import type { TenantUserRole } from "@/types/database"
import { ROL_LABEL, tienePermiso } from "@/lib/rbac"

/** Tipo de sesión detectada en el header. */
export type TipoSesion = "super-admin" | "staff" | "portal"

/** Rol de los portales ligeros (`portal_session`). */
export type RolPortal = "especialista" | "paciente"

/** Iconos disponibles para las acciones del menú (los resuelve la UI). */
export type IconoAccion =
  | "perfil"
  | "configuracion"
  | "citas"
  | "facturacion"
  | "pacientes"
  | "publico"
  | "suscripciones"

export type AccionSesion = {
  etiqueta: string
  href: string
  icono: IconoAccion
}

/** Sesión lista para pintar en el header (payload serializable). */
export type SesionHeader = {
  tipo: TipoSesion
  /** Nombre mostrado en el menú (persona o responsable de la cuenta). */
  nombre: string
  email: string | null
  /** Rol legible ('Administrador', 'Recepción', 'Paciente'…). */
  rolLabel: string
  /** Contexto de la sesión (nombre del consultorio o de la plataforma). */
  contexto: string | null
  /** CTA principal. */
  escritorio: string
  escritorioLabel: string
  /** Enlaces del desplegable (sin contar el cierre de sesión). */
  acciones: AccionSesion[]
  /** Iniciales del avatar (máx. 2 letras). */
  iniciales: string
}

/* ------------------------------------------------------------------ */
/* Iniciales del avatar                                               */
/* ------------------------------------------------------------------ */

/** Iniciales del nombre (o del correo si no hay nombre) para el avatar. */
export function inicialesDe(
  nombre: string | null | undefined,
  email?: string | null
): string {
  const base = (nombre ?? "").trim() || (email ?? "").trim()
  if (!base) return "MD"

  const partes = base
    .replace(/@.*$/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)

  const letras = partes
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
  return letras.join("") || "MD"
}

/* ------------------------------------------------------------------ */
/* Destinos por rol                                                   */
/* ------------------------------------------------------------------ */

/**
 * Primera pantalla útil de un rol del panel:
 *  - admin / recepcion → escritorio del día.
 *  - contador          → contabilidad y caja (permiso `contabilidad:leer`).
 *  - especialista / medico → agenda del día en el panel (la RLS de staff
 *    permite leer las citas del tenant); su consulta clínica vive en el portal,
 *    que se autentica con cédula + teléfono y no con la cuenta de staff.
 */
export function destinoEscritorioStaff(
  rol: TenantUserRole,
  clinicSlug: string
): string {
  switch (rol) {
    case "admin":
    case "recepcion":
      return `/${clinicSlug}/admin`
    case "contador":
      return `/${clinicSlug}/admin/contabilidad`
    case "especialista":
    case "medico":
      return `/${clinicSlug}/admin/recepcion`
    default:
      return `/${clinicSlug}/admin`
  }
}

/** Primera pantalla útil de una sesión de portal ligero. */
export function destinoPortal(rol: RolPortal, clinicSlug: string): string {
  return rol === "paciente"
    ? `/${clinicSlug}/paciente/expediente`
    : `/${clinicSlug}/especialista/dashboard`
}

/* ------------------------------------------------------------------ */
/* Constructores de la sesión del header                              */
/* ------------------------------------------------------------------ */

/** Sesión del operador de la plataforma (`user_metadata.role`). */
export function sesionSuperAdmin(input: {
  nombre: string | null
  email: string | null
}): SesionHeader {
  return {
    tipo: "super-admin",
    nombre: input.nombre?.trim() || input.email || "Super Admin",
    email: input.email,
    rolLabel: "Super Admin",
    contexto: "Plataforma Medisys",
    escritorio: "/super-admin/dashboard",
    escritorioLabel: "Ir al panel",
    acciones: [
      {
        etiqueta: "Panel de la plataforma",
        href: "/super-admin/dashboard",
        icono: "perfil",
      },
      {
        etiqueta: "Suscripciones y pagos",
        href: "/super-admin/pagos",
        icono: "suscripciones",
      },
    ],
    iniciales: inicialesDe(input.nombre, input.email),
  }
}

/**
 * Sesión del personal de una clínica (Supabase Auth + `tenant_users`).
 *
 * "Configuración" solo se ofrece a los roles con `configuracion:leer` (admin,
 * recepción, contador). El rol clínico (especialista/médico) no tiene pantalla
 * de configuración, así que en su lugar se muestra "Facturación", que sí puede
 * consultar (`facturacion:leer`).
 */
export function sesionStaff(input: {
  nombre: string | null
  email: string | null
  rol: TenantUserRole
  clinicSlug: string
  clinicNombre: string
}): SesionHeader {
  const { rol, clinicSlug } = input

  const acciones: AccionSesion[] = [
    { etiqueta: "Mi Perfil", href: `/${clinicSlug}`, icono: "publico" },
  ]

  acciones.push(
    tienePermiso(rol, "configuracion:leer")
      ? {
          etiqueta: "Configuración",
          href: `/${clinicSlug}/admin/configuracion`,
          icono: "configuracion",
        }
      : {
          etiqueta: "Facturación",
          href: `/${clinicSlug}/admin/facturacion`,
          icono: "facturacion",
        }
  )

  return {
    tipo: "staff",
    nombre: input.nombre?.trim() || input.email || "Personal",
    email: input.email,
    rolLabel: ROL_LABEL[rol] ?? "Personal",
    contexto: input.clinicNombre,
    escritorio: destinoEscritorioStaff(rol, clinicSlug),
    escritorioLabel: "Ir a mi Escritorio",
    acciones,
    iniciales: inicialesDe(input.nombre, input.email),
  }
}

/**
 * Sesión de un portal ligero (`portal_session`: especialista o paciente).
 * Sus enlaces son los del portal, el único espacio autenticado de ese usuario.
 */
export function sesionPortal(input: {
  rol: RolPortal
  nombre: string | null
  clinicSlug: string
  clinicNombre: string
}): SesionHeader {
  const { rol, clinicSlug } = input
  const esPaciente = rol === "paciente"

  return {
    tipo: "portal",
    nombre: input.nombre?.trim() || (esPaciente ? "Paciente" : "Especialista"),
    email: null,
    rolLabel: esPaciente ? "Paciente" : "Especialista",
    contexto: input.clinicNombre,
    escritorio: destinoPortal(rol, clinicSlug),
    escritorioLabel: esPaciente ? "Ir a mis citas" : "Ir a mi consulta",
    acciones: esPaciente
      ? [
          {
            etiqueta: "Mi expediente",
            href: `/${clinicSlug}/paciente/expediente`,
            icono: "perfil",
          },
          {
            etiqueta: "Agendar una cita",
            href: `/${clinicSlug}/reservar`,
            icono: "citas",
          },
        ]
      : [
          {
            etiqueta: "Mi panel",
            href: `/${clinicSlug}/especialista/dashboard`,
            icono: "perfil",
          },
          {
            etiqueta: "Mis pacientes",
            href: `/${clinicSlug}/especialista/pacientes`,
            icono: "pacientes",
          },
        ],
    iniciales: inicialesDe(input.nombre, null),
  }
}
