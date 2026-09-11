#!/usr/bin/env node
/**
 * MEDISYS · Aplicador de la migración `0015_guide_pages.sql`
 *
 * Crea la tabla `guide_pages` (RLS + políticas), el bucket público `guides`
 * y puebla las guías semilla.
 *
 * ESTRATEGIAS (en orden):
 *   1) Management API de Supabase  → requiere `SUPABASE_ACCESS_TOKEN` (sbp_…).
 *   2) Conexión directa Postgres   → requiere `DATABASE_URL` (+ driver `pg`).
 *   3) Fallback informativo        → con solo `SERVICE_ROLE_KEY` NO es posible
 *      ejecutar DDL por REST; el script asegura el bucket de Storage y muestra
 *      el SQL listo para pegar en el SQL Editor de Supabase.
 *
 * Uso:
 *   node scripts/aplicar-migracion-guias.mjs
 *   node scripts/aplicar-migracion-guias.mjs --instalar-driver   (npm i --no-save pg)
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { execFileSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"

const RUTA_MIGRACION = resolve(process.cwd(), "supabase/migrations/0015_guide_pages.sql")
const BUCKET = "guides"
const INSTALAR_DRIVER = process.argv.includes("--instalar-driver")

/** Lee `.env.local` (o `.env`) a un objeto simple. */
function cargarEnv() {
  const candidatos = [".env.local", ".env"]
  const env = {}
  for (const archivo of candidatos) {
    const ruta = resolve(process.cwd(), archivo)
    if (!existsSync(ruta)) continue
    for (const linea of readFileSync(ruta, "utf8").split(/\r?\n/)) {
      const limpia = linea.trim()
      if (!limpia || limpia.startsWith("#")) continue
      const indice = limpia.indexOf("=")
      if (indice < 0) continue
      const clave = limpia.slice(0, indice).trim()
      const valor = limpia.slice(indice + 1).trim().replace(/^["']|["']$/g, "")
      if (!(clave in env)) env[clave] = valor
    }
  }
  return env
}

/** Deriva el project ref desde la URL pública de Supabase. */
function refProyecto(url) {
  const coincidencia = String(url ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)
  return coincidencia?.[1] ?? null
}

/**
 * Busca un `SUPABASE_ACCESS_TOKEN` en: env, `.env.local`, arg `--token=` o el
 * archivo del CLI (`~/.supabase/access-token`).
 */
function buscarAccessToken(env) {
  const porArg = process.argv.find((arg) => arg.startsWith("--token="))
  if (porArg) return porArg.split("=")[1]

  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN
  if (env.SUPABASE_ACCESS_TOKEN) return env.SUPABASE_ACCESS_TOKEN

  const candidatos = [
    resolve(process.env.USERPROFILE ?? process.env.HOME ?? "", ".supabase/access-token"),
    resolve(
      process.env.APPDATA ?? "",
      "supabase/access-token"
    ),
  ]
  for (const ruta of candidatos) {
    if (ruta && existsSync(ruta)) return readFileSync(ruta, "utf8").trim()
  }
  return null
}

/** Estrategia 1: Management API (ejecuta SQL arbitrario). */
async function ejecutarViaManagementApi({ ref, token, sql }) {
  const respuesta = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  )
  const texto = await respuesta.text()
  if (!respuesta.ok) {
    throw new Error(`Management API ${respuesta.status}: ${texto.slice(0, 400)}`)
  }
  return texto
}

/** Estrategia 2: conexión directa a Postgres. */
async function ejecutarViaPostgres({ url, sql }) {
  let driver
  try {
    driver = await import("pg")
  } catch {
    if (!INSTALAR_DRIVER) {
      throw new Error(
        "Falta el driver 'pg'. Instálalo con `npm i --no-save pg` o usa --instalar-driver."
      )
    }
    execFileSync(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["i", "--no-save", "pg"],
      { stdio: "inherit" }
    )
    driver = await import("pg")
  }

  const { Client } = driver
  const cliente = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  })
  await cliente.connect()
  try {
    await cliente.query(sql)
  } finally {
    await cliente.end()
  }
}

/** Asegura el bucket público `guides` (el service role SÍ puede hacer esto). */
async function asegurarBucket(admin) {
  const { data } = await admin.storage.getBucket(BUCKET)
  if (data) {
    console.log(`• Bucket '${BUCKET}': ya existe (public=${data.public}).`)
    return
  }
  const { error } = await admin.storage.createBucket(BUCKET, { public: true })
  if (error) {
    console.log(`• Bucket '${BUCKET}': error al crear → ${error.message}`)
    return
  }
  console.log(`• Bucket '${BUCKET}': creado (public=true).`)
}

/** Consulta de verificación sobre `guide_pages`. */
async function verificarTabla(admin) {
  const { data, error } = await admin
    .from("guide_pages")
    .select("slug, title, category, order_index, is_published")
    .order("category", { ascending: true })
    .order("order_index", { ascending: true })

  if (error) return { ok: false, message: error.message, filas: [] }
  return { ok: true, message: null, filas: data ?? [] }
}

/**
 * Extrae las guías semilla del archivo SQL (slug, título, categoría, orden y
 * el markdown entre `$md$…$md$`). Permite sembrar por REST sin permisos DDL.
 */
function extraerSemillas(sql) {
  const patron =
    /'([a-z0-9-]+)',\s*'([^']*)',\s*'([^']*)',\s*(\d+),\s*\$md\$([\s\S]*?)\$md\$/g
  const semillas = []
  for (const coincidencia of sql.matchAll(patron)) {
    semillas.push({
      slug: coincidencia[1],
      title: coincidencia[2],
      category: coincidencia[3],
      order_index: Number(coincidencia[4]),
      content_markdown: coincidencia[5],
    })
  }
  return semillas
}

/**
 * Siembra las guías faltantes con el cliente service_role (INSERT es DML, sí
 * permitido por REST). Idempotente: usa upsert por `slug`.
 */
async function sembrarGuias(admin, semillas) {
  if (semillas.length === 0) {
    console.log("• Semilla: no se detectaron guías en el archivo SQL.")
    return
  }

  const { data: existentes, error } = await admin.from("guide_pages").select("slug")
  if (error) {
    console.log(`• Semilla: omitida (${error.message})`)
    return
  }

  const yaEstan = new Set((existentes ?? []).map((fila) => fila.slug))
  const faltantes = semillas.filter((semilla) => !yaEstan.has(semilla.slug))

  if (faltantes.length === 0) {
    console.log(`• Semilla: las ${semillas.length} guías ya estaban presentes.`)
    return
  }

  const { error: errorUpsert } = await admin
    .from("guide_pages")
    .upsert(faltantes.map((g) => ({ ...g, is_published: true })), { onConflict: "slug" })

  if (errorUpsert) {
    console.log(`• Semilla: error al insertar → ${errorUpsert.message}`)
    return
  }
  console.log(`• Semilla: ${faltantes.length} guía(s) insertadas por REST:`)
  for (const guia of faltantes) console.log(`   + ${guia.slug}`)
}

function imprimirInstrucciones(sql) {
  console.log("\n── Sin credenciales DDL ─────────────────────────────────────────────")
  console.log("El `SERVICE_ROLE_KEY` no permite ejecutar DDL por REST. Para aplicar")
  console.log("la migración, elige UNA opción:\n")
  console.log("  A) SQL Editor de Supabase → pega el contenido completo de")
  console.log("     supabase/migrations/0015_guide_pages.sql (o el bloque de abajo).")
  console.log("  B) Da credenciales al script y vuelve a ejecutarlo:")
  console.log("     · SUPABASE_ACCESS_TOKEN=sbp_xxx   (Management API, recomendado)")
  console.log("     · DATABASE_URL=postgresql://postgres.<ref>:<password>@…")
  console.log("       (+ `npm i --no-save pg` o flag --instalar-driver)\n")
  console.log("── SQL a ejecutar ──────────────────────────────────────────────────")
  console.log(sql)
  console.log("────────────────────────────────────────────────────────────────────\n")
}

async function main() {
  if (!existsSync(RUTA_MIGRACION)) {
    throw new Error(`No se encontró la migración: ${RUTA_MIGRACION}`)
  }
  const sql = readFileSync(RUTA_MIGRACION, "utf8")

  const env = cargarEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.")
  }

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log("MEDISYS · Aplicando migración 0015_guide_pages.sql\n")

  // 1) Bucket (siempre posible con service role).
  await asegurarBucket(admin)

  // 2) DDL.
  const ref = refProyecto(url)
  const token = buscarAccessToken(env)
  const dbUrl =
    process.argv.find((arg) => arg.startsWith("--db-url="))?.split("=")[1] ||
    env.DATABASE_URL ||
    env.SUPABASE_DB_URL ||
    env.POSTGRES_URL ||
    env.DIRECT_URL

  let ddl = { aplicado: false, via: null, detalle: null }

  if (token && ref) {
    try {
      await ejecutarViaManagementApi({ ref, token, sql })
      ddl = { aplicado: true, via: "Management API", detalle: null }
    } catch (error) {
      ddl = { aplicado: false, via: "Management API", detalle: error.message }
    }
  }

  if (!ddl.aplicado && dbUrl) {
    try {
      await ejecutarViaPostgres({ url: dbUrl, sql })
      ddl = { aplicado: true, via: "Postgres directo", detalle: null }
    } catch (error) {
      ddl = { aplicado: false, via: "Postgres directo", detalle: error.message }
    }
  }

  if (ddl.aplicado) {
    console.log(`• DDL aplicado vía ${ddl.via}.`)
  } else if (ddl.detalle) {
    console.log(`• DDL no aplicado vía ${ddl.via}: ${ddl.detalle}`)
    imprimirInstrucciones(sql)
  } else {
    imprimirInstrucciones(sql)
  }

  // 3) Semilla por REST (funciona aunque no haya permisos DDL).
  await sembrarGuias(admin, extraerSemillas(sql))

  // 4) Verificación de lectura.
  const verificacion = await verificarTabla(admin)
  console.log("── Verificación de lectura de `guide_pages` ────────────────────────")
  if (!verificacion.ok) {
    console.log(`✗ ${verificacion.message}`)
    process.exitCode = 1
  } else {
    console.log(`✓ ${verificacion.filas.length} fila(s) encontradas:`)
    for (const fila of verificacion.filas) {
      console.log(
        `   · [${fila.category}] #${fila.order_index} ${fila.slug} — ${fila.title}${
          fila.is_published ? "" : " (borrador)"
        }`
      )
    }
    if (verificacion.filas.length === 0) {
      console.log("   (la tabla existe pero no tiene guías; revisa la semilla)")
    }
  }
}

main().catch((error) => {
  console.error("\n✗ Error:", error?.message ?? error)
  process.exitCode = 1
})
