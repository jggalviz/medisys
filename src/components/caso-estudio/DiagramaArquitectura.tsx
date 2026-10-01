import {
  ArrowDown,
  Cloud,
  Database,
  LayoutDashboard,
  MonitorSmartphone,
  Puzzle,
  Layers,
} from "lucide-react"

type Capa = {
  nivel: string
  titulo: string
  icon: typeof Layers
  detalle: string
  chips: readonly string[]
}

/** Mapa conceptual por capas: qué conoce a qué y en qué dirección. */
const CAPAS: readonly Capa[] = [
  {
    nivel: "01",
    titulo: "Clientes",
    icon: MonitorSmartphone,
    detalle:
      "Tres superficies con necesidades opuestas: el paciente reserva sin crear cuenta, el personal opera la clínica y el operador de la plataforma administra los tenants.",
    chips: ["/[clinicSlug]/reservar", "/[clinicSlug]/admin", "/super-admin"],
  },
  {
    nivel: "02",
    titulo: "Borde y enrutado",
    icon: LayoutDashboard,
    detalle:
      "El proxy de Next.js 16 (antes middleware) resuelve la clínica desde el slug, exige sesión y membresía en tenant_users para /[clinicSlug]/admin/*, redirige al login conservando el destino, bloquea /super-admin/* por rol del token y saca del matcher /api/** para que cada Route Handler valide con RLS. La landing y este caso de estudio son rutas estáticas del mismo despliegue.",
    chips: ["proxy.ts (ex-middleware)", "/:clinicSlug/admin/:path*", "/super-admin/:path*"],
  },
  {
    nivel: "03",
    titulo: "Aplicación · Next.js 16 (App Router)",
    icon: Layers,
    detalle:
      "Server Components leen y renderizan en el servidor; Server Actions mutan el estado sin una capa REST intermedia; los Route Handlers cubren lo que necesita HTTP puro (cron diario, PDF y webhooks).",
    chips: ["RSC", "20 módulos use server", "Route Handlers"],
  },
  {
    nivel: "04",
    titulo: "Dominio puro (sin E/S)",
    icon: Puzzle,
    detalle:
      "Reglas fiscales, tasas, roles y validaciones en módulos de TypeScript puros: no conocen la base de datos, se importan desde el servidor y desde el navegador, y son fáciles de razonar y revisar.",
    chips: ["fiscal-ve.ts", "billing-ve.ts", "bcv.ts", "rbac.ts"],
  },
  {
    nivel: "05",
    titulo: "Datos · Postgres (Supabase)",
    icon: Database,
    detalle:
      "16 tablas y 64 políticas RLS: cada consulta se evalúa contra la identidad del usuario y su clínica. Auth y Storage (logos, guías, comprobantes) viven en el mismo proyecto; la clave de servicio nunca llega al navegador.",
    chips: ["Row Level Security", "Auth", "Storage"],
  },
  {
    nivel: "06",
    titulo: "Servicios externos",
    icon: Cloud,
    detalle:
      "El portal del BCV y dos APIs de respaldo alimentan la tasa; Vercel Cron ejecuta la captura diaria; los avisos salen por enlaces profundos de WhatsApp para no depender de una API de mensajería.",
    chips: ["bcv.org.ve", "dolarapi.com", "pydolarve.org", "Vercel Cron"],
  },
]

/** Diagrama de capas construido con DOM: accesible, responsivo y sin imágenes. */
export function DiagramaArquitectura() {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Mapa de capas
        </p>
        <p className="font-mono text-[11px] text-zinc-400">
          las dependencias fluyen hacia abajo
        </p>
      </div>

      <ol className="mt-5">
        {CAPAS.map((capa, indice) => {
          const Icono = capa.icon
          return (
            <li key={capa.nivel}>
              <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 sm:flex-row sm:items-start sm:gap-5">
                <div className="flex items-center gap-3 sm:w-64 sm:shrink-0">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-teal-300">
                    <Icono className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] tabular-nums text-zinc-400">
                      NIVEL {capa.nivel}
                    </p>
                    <p className="text-sm font-bold text-zinc-900">
                      {capa.titulo}
                    </p>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-sm leading-6 text-zinc-600">
                    {capa.detalle}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {capa.chips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[10.5px] text-zinc-500"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {indice < CAPAS.length - 1 ? (
                <div className="flex justify-center py-1.5">
                  <ArrowDown className="size-3.5 text-zinc-300" aria-hidden="true" />
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>

      <p className="mt-5 text-xs leading-5 text-zinc-500">
        La dirección importa: la aplicación conoce el dominio y la base de datos,
        el dominio no conoce a la aplicación. Por eso el motor fiscal se puede
        leer y verificar sin levantar el servidor, y por eso un cambio de
        alícuota es un cambio de una constante en un archivo.
      </p>
    </div>
  )
}
