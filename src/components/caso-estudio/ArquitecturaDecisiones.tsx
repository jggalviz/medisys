import { Layers, ShieldCheck, TrendingUp } from "lucide-react"

import { CodePanel } from "@/components/caso-estudio/piezas"
import { TarjetaDecision } from "@/components/caso-estudio/TarjetaDecision"

/** Las tres decisiones estructurales, con su costo declarado. */
export function ArquitecturaDecisiones() {
  return (
    <div className="space-y-6">
      <TarjetaDecision
        numero="01"
        icon={Layers}
        titulo="Monolito modular en Next.js 16, sin microservicios"
        decision="Una sola aplicación desplegada en Vercel con App Router: Server Components para leer datos, Server Actions para escribirlos y módulos de dominio puros en lugar de servicios separados."
        porque={[
          "Un despliegue atómico: no hay contratos HTTP entre servicios ni coordinación de versiones entre despliegues.",
          "Server Components eliminan el viaje cliente → API → servidor: la página llega renderizada y el panel envía menos JavaScript al navegador.",
          "Server Actions removieron la capa REST intermedia: una mutación es una función tipada, no un endpoint que hay que versionar y documentar aparte.",
          "Los tipos de la base de datos viajan de extremo a extremo: si una columna cambia, el compilador avisa antes del despliegue.",
          "Productividad de una sola persona: interfaz, regla de negocio y validación viven en el mismo módulo y se revisan en un mismo diff.",
        ]}
        compromiso="El despliegue queda acoplado: un fallo en cualquier módulo afecta a todo el producto. Lo compenso manteniendo el dominio en módulos puros sin E/S, tolerando esquemas parcialmente migrados y desplegando cambios pequeños y frecuentes en lugar de lotes trimestrales."
      />

      <TarjetaDecision
        numero="02"
        icon={ShieldCheck}
        titulo="La seguridad en la base de datos, no solo en el código"
        decision="Postgres con Row Level Security como frontera principal, más funciones SECURITY DEFINER (is_staff, is_tenant_admin, is_super_admin) que resuelven la pertenencia del usuario a una clínica y su rol."
        porque={[
          "64 políticas sobre 16 tablas: aunque la interfaz tuviera un descuido, la consulta no puede cruzar datos entre clínicas.",
          "Las políticas se evalúan contra la identidad del token (auth.uid()), no contra parámetros que el cliente pueda enviar o manipular.",
          "El navegador nunca recibe la clave service_role: solo el cron del servidor la usa para persistir la tasa diaria y saltar RLS de forma controlada.",
          "Storage con el mismo criterio: lectura pública para los logos de marca y escritura restringida al personal autenticado.",
          "Fallo seguro por defecto: sin una política que lo permita, el acceso simplemente no ocurre, sin depender de que alguien recuerde escribir el filtro correcto.",
        ]}
        compromiso="Depurar políticas declarativas es más lento que leer un if en TypeScript y algunas consultas exigen funciones auxiliares. A cambio, el aislamiento entre clientes deja de depender de la disciplina de cada desarrollador."
      />

      <TarjetaDecision
        numero="03"
        icon={TrendingUp}
        titulo="El motor de tasas como sistema resiliente, no como una llamada HTTP"
        decision="Una cascada de cuatro niveles —portal del BCV, APIs alternativas, última tasa persistida y valor de respaldo— que nunca lanza una excepción y siempre informa de dónde salió el número."
        porque={[
          "El BCV no publica API y su portal bloquea clientes sin User-Agent de navegador: depender de una única fuente era inaceptable para un sistema que factura.",
          "Caché HTTP de una hora en las consultas externas (revalidate: 3600) para no abusar de la fuente ni castigar la latencia del panel.",
          "Un cron diario captura la tasa y la persiste con service_role, alimentando el nivel de respaldo de la cascada.",
          "El administrador puede fijar la tasa manualmente y consultar el historial de capturas cuando el portal publica tarde.",
        ]}
        compromiso="Puedo servir un dato con horas de antigüedad. Por eso cada importe en la interfaz muestra la fuente y la fecha de captura, y el override manual conserva la última palabra para el operador."
      >
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <CodePanel
            ruta="src/lib/bcv.ts"
            nota="La función devuelve tasa + fuente + descripción legible: el nivel del respaldo se conserva hasta la interfaz."
          >{`export async function getLatestBcvRateDetallada(
  supabase: Client
): Promise<BcvRateInfo> {
  // 1) portal BCV (scraping) → 2) dolarapi → 3) pydolarve
  const enVivo = await obtenerTasaBcvEnVivo()
  if (enVivo) return enVivo

  // 4) última fila guardada en bcv_rates
  const enDb = await leerTasaBcvDb(supabase)
  if (enDb) {
    return { tasa: enDb, fuente: "db", detalle: "bcv_rates (última guardada)" }
  }

  // 5) último recurso: constante de respaldo
  return { tasa: TASA_BCV_FALLBACK, fuente: "fallback", detalle: "respaldo" }
}`}</CodePanel>

          <CodePanel
            ruta="vercel.json"
            nota="El Route Handler valida Authorization: Bearer CRON_SECRET y declara maxDuration = 30."
          >{`{
  "crons": [
    {
      "path": "/api/cron/bcv-rate",
      "schedule": "0 12 * * *"
    }
  ]
}`}</CodePanel>
        </div>
      </TarjetaDecision>
    </div>
  )
}
