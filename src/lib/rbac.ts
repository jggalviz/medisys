/**
 * MEDISYS · RBAC del personal (multi-sede)
 * ----------------------------------------------------------
 * Fuente única de verdad de los roles y permisos del módulo de administración.
 *
 * Roles soportados:
 *   ADMIN       → control total (configuración fiscal, sedes, catálogo, cobros).
 *   RECEPCION   → agenda, cobros en caja y verificación de pagos.
 *   MEDICO      → su agenda y sus consultas (alias histórico: `especialista`).
 *   CONTADOR    → lectura fiscal/financiera (reportes, tasas, catálogo).
 *
 * El módulo es puro (sin dependencias de servidor) para poder usarse tanto en
 * RLS/Server Actions/Route Handlers como en componentes cliente.
 */
import type { TenantUserRole } from "@/types/database"

/** Roles admitidos en `tenant_users.role` (migración 0016). */
export const ROLES_SOPORTADOS: readonly TenantUserRole[] = [
  "admin",
  "recepcion",
  "especialista",
  "medico",
  "contador",
]

export const ROL_LABEL: Record<TenantUserRole, string> = {
  admin: "Administrador",
  recepcion: "Recepción",
  especialista: "Especialista",
  medico: "Médico",
  contador: "Contador",
}

/** Permisos granulares del panel administrativo. */
export type PermisoAdmin =
  | "configuracion:leer"
  | "configuracion:escribir"
  | "fiscal:leer"
  | "fiscal:escribir"
  | "tasa:leer"
  | "tasa:escribir"
  | "servicios:leer"
  | "servicios:escribir"
  | "sedes:leer"
  | "sedes:escribir"
  | "usuarios:escribir"
  | "cobros:recaudar"
  | "cobros:registrar"
  | "facturacion:leer"
  | "facturacion:emitir"
  | "facturacion:anular"
  | "contabilidad:leer"
  | "contabilidad:escribir"
  | "honorarios:leer"
  | "honorarios:escribir"
  | "consulta:atender"

const PERMISOS_POR_ROL: Record<TenantUserRole, readonly PermisoAdmin[]> = {
  admin: [
    "configuracion:leer",
    "configuracion:escribir",
    "fiscal:leer",
    "fiscal:escribir",
    "tasa:leer",
    "tasa:escribir",
    "servicios:leer",
    "servicios:escribir",
    "sedes:leer",
    "sedes:escribir",
    "usuarios:escribir",
    "cobros:recaudar",
    "cobros:registrar",
    "facturacion:leer",
    "facturacion:emitir",
    "facturacion:anular",
    "contabilidad:leer",
    "contabilidad:escribir",
    "honorarios:leer",
    "honorarios:escribir",
    "consulta:atender",
  ],
  recepcion: [
    "configuracion:leer",
    "servicios:leer",
    "sedes:leer",
    "tasa:leer",
    "cobros:recaudar",
    "cobros:registrar",
    "facturacion:leer",
    "facturacion:emitir",
    "contabilidad:leer",
    "contabilidad:escribir",
  ],
  especialista: [
    "servicios:leer",
    "facturacion:leer",
    "consulta:atender",
  ],
  medico: ["servicios:leer", "facturacion:leer", "consulta:atender"],
  contador: [
    "configuracion:leer",
    "fiscal:leer",
    "fiscal:escribir",
    "tasa:leer",
    "tasa:escribir",
    "servicios:leer",
    "sedes:leer",
    "facturacion:leer",
    "facturacion:anular",
    "contabilidad:leer",
    "contabilidad:escribir",
    "honorarios:leer",
    "honorarios:escribir",
  ],
}

/** ¿El rol tiene el permiso indicado? */
export function tienePermiso(
  rol: TenantUserRole,
  permiso: PermisoAdmin
): boolean {
  return PERMISOS_POR_ROL[rol]?.includes(permiso) ?? false
}

/** Permisos efectivos del rol (copia defensiva). */
export function permisosDeRol(rol: TenantUserRole): PermisoAdmin[] {
  return [...(PERMISOS_POR_ROL[rol] ?? [])]
}

/** ¿Es administrador de la clínica? (único rol con escritura total). */
export function esRolAdmin(rol: TenantUserRole | null | undefined): boolean {
  return rol === "admin"
}

/**
 * Traduce etiquetas externas (formularios, migraciones, importer de datos) al
 * rol almacenado. Acepta mayúsculas y sinónimos en español.
 */
export function normalizarRol(valor: unknown): TenantUserRole | null {
  if (typeof valor !== "string") return null
  const limpio = valor.trim().toLowerCase()
  const mapa: Record<string, TenantUserRole> = {
    admin: "admin",
    administrador: "admin",
    administrador_a: "admin",
    recepcion: "recepcion",
    recepcionista: "recepcion",
    front_desk: "recepcion",
    medico: "medico",
    doctor: "medico",
    especialista: "especialista",
    contador: "contador",
    contabilidad: "contador",
  }
  return mapa[limpio] ?? null
}

/**
 * Expande los roles almacenados al conjunto operativo que los consume:
 * `especialista` y `medico` se tratan como equivalentes en la agenda.
 */
export function rolesOperativos(rol: TenantUserRole): TenantUserRole[] {
  if (rol === "especialista") return ["especialista", "medico"]
  if (rol === "medico") return ["medico", "especialista"]
  return [rol]
}
