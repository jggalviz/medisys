#!/usr/bin/env node
/**
 * MEDISYS · Aplicador de la migración `0020_planes_individual_pyme_pro.sql`
 *
 * Unifica `plan_type` en los 3 tiers comerciales (INDIVIDUAL · PYME · PRO) y
 * normaliza los valores heredados ('CLINICA', 'PRO' de 1 especialista,
 * 'independiente', 'multi_especialista').
 *
 * ESTRATEGIAS (en orden):
 *   1) Management API de Supabase → requiere `SUPABASE_ACCESS_TOKEN` (sbp_…).
 *   2) Conexión directa Postgres  → requiere `DATABASE_URL` (+ driver `pg`).
 *   3) Fallback informativo       → con solo `SERVICE_ROLE_KEY` NO es posible
 *      ejecutar DDL por REST: muestra el SQL listo para el SQL Editor.
 *
 * Uso:
 *   node scripts/aplicar-migracion-planes.mjs
 *   node scripts/aplicar-migracion-planes.mjs --instalar-driver
 *   node scripts/aplicar-migracion-planes.mjs --token=sbp_xxx
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { execFileSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"

const RUTA_MIGRACION = resolve(
  process.cwd(),
  "supabase/migrations/0020_planes_individual_pyme_pro.sql"
)
const INSTALAR_DRIVER = process.argv.includes("--instalar-driver")

/** Lee `.env.local` (o `.env`) a un objeto simple. */
function cargarEnv() {
  const env = {}
  for (const archivo of [".env.local", ".env"]) {
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

/** Access token para la Management API (env, `.env.local`, `--token=` o CLI). */
function buscarAccessToken(env) {
  const porArg = process.argv.find((arg) => arg.startsWith("--token="))
  if (porArg) return porArg.split("=")[1]

  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN
  if (env.SUPABASE_ACCESS_TOKEN) return env.SUPABASE_ACCESS_TOKEN

  const candidatos = [
    resolve(process.env.USERPROFILE ?? process.env.HOME ?? "", ".supabase/access-token"),
    resolve(process.env.APPDATA ?? "", "supabase/access-token"),
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

/** Verificación de lectura (REST): distribución de `plan_type` por tenant. */
async function verificarPlanes(admin) {
  const { data, error } = await admin
    .from("tenants")
    .select("slug, nombre, plan_type, max_especialistas")
    .order("slug", { ascending: true })

  if (error) return { ok: false, message: error.message, filas: [] }
  return { ok: true, message: null, filas: data ?? [] }
}

function imprimirInstrucciones(sql) {
  console.log("\n── La migración NO se aplicó (no hay permisos DDL por REST). ────\n")
  console.log("Elige UNA opción:")
  console.log("  A) SQL Editor de Supabase → pega el contenido completo de")
  console.log("     supabase/migrations/0020_planes_individual_pyme_pro.sql")
  console.log("  B) Da credenciales al script y vuelve a ejecutarlo:")
  console.log("     · SUPABASE_ACCESS_TOKEN=sbp_xxx   (Management API, recomendado)")
  console.log("     · DATABASE_URL=postgresql://postgres.<ref>:<password>@…")
  console.log("       (+ `npm i --no-save pg` o flag --instalar-driver)\n")
  console.log("── SQL a ejecutar ─────────────────────────────────────────────────")
  console.log(sql)
  console.log("───────────────────────────────────────────────────────────────────\n")
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

  console.log("MEDISYS · Aplicando migración 0020_planes_individual_pyme_pro.sql\n")

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

  const verificacion = await verificarPlanes(admin)
  console.log("── Verificación de `plan_type` por tenant ─────────────────────────")
  if (!verificacion.ok) {
    console.log(`✗ ${verificacion.message}`)
    process.exitCode = 1
    return
  }

  const pendientes = verificacion.filas.filter(
    (f) => !["INDIVIDUAL", "PYME", "PRO"].includes(String(f.plan_type))
  )
  for (const fila of verificacion.filas) {
    console.log(
      `   · ${fila.slug} · plan=${fila.plan_type} · cupo=${fila.max_especialistas} — ${fila.nombre}`
    )
  }
  if (pendientes.length > 0) {
    console.log(
      `✗ Hay ${pendientes.length} tenant(s) con un valor heredado: aplica la migración.`
    )
    process.exitCode = 1
  } else {
    console.log("✓ Todos los tenants usan INDIVIDUAL · PYME · PRO.")
  }
}

main().catch((error) => {
  console.error("\n✗ Error:", error?.message ?? error)
  process.exitCode = 1
})

