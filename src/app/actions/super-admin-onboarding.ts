"use server"

/**
 * MEDISYS · Onboarding de nuevos clientes (Super Admin).
 *
 * `createClientTenant` da de alta en un solo flujo:
 *  1. Usuario administrador/médico en Supabase Auth.
 *  2. Fila en `tenants` (plan PRO → max_especialistas = 1).
 *  3. Membresía en `tenant_users` con rol 'admin'.
 *  4. Si el plan es PRO, el registro en `doctors`.
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { getSuperAdmin } from "@/lib/super-admin"
import type { PlanTenant } from "@/types/database"

export type CreateClientTenantInput = {
  plan: PlanTenant
  nombre: string
  slug: string
  email: string
  password: string
  telefono?: string | null
  rif?: string | null
  direccion?: string | null
  maxEspecialistas?: number | null
  /** Datos del único médico (obligatorios si plan === 'PRO'). */
  doctor?: {
    nombre: string
    especialidad: string
    cedula?: string | null
    telefono?: string | null
    precioConsulta?: number | null
  } | null
}

export type CreateClientTenantResult =
  | { ok: true; data: { tenantId: string; slug: string; userId: string } }
  | { ok: false; message: string }

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function limpiarSlug(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function partesNombre(nombre: string): { nombres: string; apellidos: string } {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  return { nombres: partes[0] ?? "", apellidos: partes.slice(1).join(" ") }
}

export async function createClientTenant(
  input: CreateClientTenantInput
): Promise<CreateClientTenantResult> {
  const sesion = await getSuperAdmin()
  if (!sesion) {
    return { ok: false, message: "No autorizado: requiere super admin." }
  }

  const nombre = input.nombre?.trim()
  const slug = limpiarSlug(input.slug || input.nombre || "")
  const email = input.email?.trim().toLowerCase()
  const password = input.password
  const esPro = input.plan === "PRO"

  if (!nombre) return { ok: false, message: "El nombre de la clínica es obligatorio." }
  if (!slug || !SLUG_RE.test(slug)) {
    return { ok: false, message: "El slug solo permite minúsculas, números y guiones." }
  }
  if (!email || !password || password.length < 6) {
    return {
      ok: false,
      message: "Indica un correo válido y una contraseña de al menos 6 caracteres.",
    }
  }
  if (esPro && !input.doctor?.nombre?.trim()) {
    return { ok: false, message: "El Plan PRO requiere los datos del especialista." }
  }

  const supabase = createAdminClient()
  const maxEspecialistas = esPro
    ? 1
    : Math.max(1, Math.floor(Number(input.maxEspecialistas) || 1))

  // Slug único
  const { data: existente } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle()
  if (existente) {
    return { ok: false, message: `El slug "${slug}" ya está en uso.` }
  }

  // 1) Usuario en Auth
  const { data: creado, error: errAuth } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "admin" },
  })
  if (errAuth || !creado.user) {
    return {
      ok: false,
      message: errAuth?.message ?? "No se pudo crear el usuario administrador.",
    }
  }
  const userId = creado.user.id

  async function rollback() {
    await supabase.from("tenants").delete().eq("slug", slug)
    await supabase.auth.admin.deleteUser(userId)
  }

  // 2) Tenant
  const { data: tenant, error: errTenant } = await supabase
    .from("tenants")
    .insert({
      nombre,
      slug,
      plan_type: input.plan,
      max_especialistas: maxEspecialistas,
      telefono: input.telefono?.trim() || null,
      rif: input.rif?.trim() || null,
      direccion: input.direccion?.trim() || null,
      logo_url: null,
      datos_pago_movil: null,
      is_active: true,
      pago_movil_enabled: true,
    })
    .select("id, slug")
    .maybeSingle()
  if (errTenant || !tenant) {
    await supabase.auth.admin.deleteUser(userId)
    return {
      ok: false,
      message: errTenant?.message ?? "No se pudo crear la clínica.",
    }
  }

  // 3) Membresía admin
  const { error: errMember } = await supabase.from("tenant_users").insert({
    tenant_id: tenant.id,
    user_id: userId,
    role: "admin",
    precio_consulta: esPro
      ? Math.max(0, Number(input.doctor?.precioConsulta) || 0)
      : null,
  })
  if (errMember) {
    await rollback()
    return { ok: false, message: `No se pudo asignar el rol admin: ${errMember.message}` }
  }

  // 4) Doctor automático para Plan PRO
  if (esPro && input.doctor) {
    const partes = partesNombre(input.doctor.nombre)
    const { error: errDoctor } = await supabase.from("doctors").insert({
      tenant_id: tenant.id,
      nombres: partes.nombres,
      apellidos: partes.apellidos,
      especialidad: input.doctor.especialidad?.trim() || "General",
      cedula: input.doctor.cedula?.trim() || null,
      telefono: input.doctor.telefono?.trim() || null,
      precio_consulta: Math.max(0, Number(input.doctor.precioConsulta) || 0),
    })
    if (errDoctor) {
      await rollback()
      return {
        ok: false,
        message: `No se pudo crear el especialista: ${errDoctor.message}`,
      }
    }
  }

  return { ok: true, data: { tenantId: tenant.id, slug: tenant.slug, userId } }
}
