/**
 * MEDISYS · Limpieza de logos/fotos obsoletos ("Santa Inés").
 *
 * Ejecuta en Supabase (con la SERVICE ROLE KEY del `.env.local`):
 *   - `UPDATE tenants SET logo_url = NULL` para los tenants demo y para
 *     cualquier logo cuyo string contenga "santa", "santaines" o "ines".
 *   - Lo mismo para `doctors.foto_url` (fotos de especialistas).
 *
 * Uso:  node scripts/limpiar-logos-demo.mjs
 *   (opcional) --slug=clinica-demo  → limita a un tenant
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

const TERMINOS = ["santa", "santaines", "ines"]
const SLUGS_DEMO = ["clinica-demo", "medico-pro-demo"]

function normalizar(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function esObsoleta(url) {
  if (typeof url !== "string") return false
  const limpio = url.trim()
  if (!limpio) return false
  const comparacion = normalizar(limpio)
  return TERMINOS.some((termino) => comparacion.includes(termino))
}

function cargarEnvLocal() {
  const ruta = resolve(process.cwd(), ".env.local")
  const contenido = readFileSync(ruta, "utf8")
  const env = {}
  for (const linea of contenido.split(/\r?\n/)) {
    const limpia = linea.trim()
    if (!limpia || limpia.startsWith("#")) continue
    const indice = limpia.indexOf("=")
    if (indice < 0) continue
    const clave = limpia.slice(0, indice).trim()
    const valor = limpia.slice(indice + 1).trim().replace(/^["']|["']$/g, "")
    env[clave] = valor
  }
  return env
}

async function main() {
  const env = cargarEnvLocal()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local")
  }

  const slugFiltro = process.argv
    .find((arg) => arg.startsWith("--slug="))
    ?.split("=")[1]

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ---------------------------- tenants ----------------------------
  const { data: tenants, error: errTenants } = await supabase
    .from("tenants")
    .select("id, slug, nombre, logo_url")
    .not("logo_url", "is", null)
  if (errTenants) throw errTenants

  const candidatos = (tenants ?? []).filter((t) =>
    slugFiltro ? t.slug === slugFiltro : true
  )

  const aLimpiar = candidatos.filter(
    (t) => SLUGS_DEMO.includes(t.slug) || esObsoleta(t.logo_url)
  )

  console.log(`tenants con logo_url: ${candidatos.length}`)
  for (const t of candidatos) {
    const motivo = SLUGS_DEMO.includes(t.slug)
      ? "tenant demo"
      : esObsoleta(t.logo_url)
        ? "término obsoleto"
        : null
    console.log(`  · ${t.slug} (${t.nombre}) → ${t.logo_url}${motivo ? ` [${motivo}]` : ""}`)
  }

  if (aLimpiar.length === 0) {
    console.log("✓ No hay logos de tenants por limpiar.")
  } else {
    const ids = aLimpiar.map((t) => t.id)
    const { error } = await supabase
      .from("tenants")
      .update({ logo_url: null })
      .in("id", ids)
    if (error) throw error
    console.log(`✓ tenants actualizados (logo_url = NULL): ${aLimpiar.length}`)
    for (const t of aLimpiar) console.log(`   - ${t.slug}`)
  }

  // ---------------------------- doctors ----------------------------
  const { data: doctores, error: errDoctores } = await supabase
    .from("doctors")
    .select("id, tenant_id, nombres, apellidos, foto_url")
    .not("foto_url", "is", null)
  if (errDoctores) throw errDoctores

  const fotosObsoletas = (doctores ?? []).filter((d) => esObsoleta(d.foto_url))
  if (fotosObsoletas.length === 0) {
    console.log("✓ No hay fotos de especialistas por limpiar.")
  } else {
    const { error } = await supabase
      .from("doctors")
      .update({ foto_url: null })
      .in(
        "id",
        fotosObsoletas.map((d) => d.id)
      )
    if (error) throw error
    console.log(`✓ especialistas actualizados (foto_url = NULL): ${fotosObsoletas.length}`)
    for (const d of fotosObsoletas) {
      console.log(`   - ${d.nombres ?? ""} ${d.apellidos ?? ""} → ${d.foto_url}`)
    }
  }
}

main()
  .then(() => {
    console.log("Limpieza completada.")
  })
  .catch((error) => {
    console.error("Error en la limpieza:", error?.message ?? error)
    process.exitCode = 1
  })
