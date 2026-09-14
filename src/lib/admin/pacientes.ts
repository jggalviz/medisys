/**
 * MEDISYS · Pacientes facturables (Módulo 2)
 * -----------------------------------------------------------------
 * Directorio reducido de `profiles` para el selector de facturación: incluye
 * los datos fiscales del Módulo 1 (`tipo_documento`, `documento_identidad`,
 * `razon_social`, `direccion_fiscal`) con tolerancia a instalaciones que aún
 * no aplicaron la migración 0016.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

import type { AdminModuleResult } from "@/types/admin"
import type { Database, TipoDocumentoFiscal } from "@/types/database"
import { TIPOS_DOCUMENTO } from "@/lib/fiscal-ve"

type Client = SupabaseClient<Database>

export type PacienteFacturable = {
  id: string
  nombre: string
  cedula: string | null
  telefono: string | null
  email: string | null
  tipoDocumento: TipoDocumentoFiscal | null
  documentoIdentidad: string | null
  razonSocial: string | null
  direccionFiscal: string | null
}

function textoONull(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim().length > 0 ? valor.trim() : null
}

function tipoDocumentoValido(valor: unknown): TipoDocumentoFiscal | null {
  return typeof valor === "string" &&
    (TIPOS_DOCUMENTO as readonly string[]).includes(valor)
    ? (valor as TipoDocumentoFiscal)
    : null
}

/** Fila de `profiles` → DTO facturable. */
export function aPacienteFacturable(
  fila: Record<string, unknown>
): PacienteFacturable {
  const nombre =
    [fila.nombres, fila.apellidos].filter(Boolean).join(" ").trim() || "Paciente"

  return {
    id: String(fila.id ?? ""),
    nombre,
    cedula: textoONull(fila.cedula),
    telefono: textoONull(fila.telefono),
    email: textoONull(fila.email),
    tipoDocumento: tipoDocumentoValido(fila.tipo_documento),
    documentoIdentidad: textoONull(fila.documento_identidad),
    razonSocial: textoONull(fila.razon_social),
    direccionFiscal: textoONull(fila.direccion_fiscal),
  }
}

/**
 * Lista los pacientes de la clínica (para el selector de la facturación).
 * La búsqueda se resuelve en memoria para no depender de columnas fiscales
 * ausentes en instalaciones antiguas.
 */
export async function listarPacientesFacturables(
  supabase: Client,
  tenantId: string,
  opciones: { q?: string | null; limite?: number } = {}
): Promise<AdminModuleResult<PacienteFacturable[]>> {
  const { q, limite = 100 } = opciones

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("nombres", { ascending: true })
      .limit(Math.min(Math.max(limite, 1), 300))

    if (error) {
      return {
        ok: false,
        code: "SERVER_ERROR",
        message: `No se pudo leer el directorio de pacientes: ${error.message}.`,
      }
    }

    const pacientes = (data ?? []).map((fila) =>
      aPacienteFacturable(fila as Record<string, unknown>)
    )

    if (!q?.trim()) return { ok: true, data: pacientes }

    const termino = q.trim().toLowerCase()
    return {
      ok: true,
      data: pacientes.filter((paciente) =>
        [
          paciente.nombre,
          paciente.cedula,
          paciente.documentoIdentidad,
          paciente.razonSocial,
          paciente.telefono,
          paciente.email,
        ].some((campo) => campo?.toLowerCase().includes(termino))
      ),
    }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al listar los pacientes.",
    }
  }
}
