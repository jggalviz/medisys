import Link from "next/link"
import type { Metadata } from "next"
import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BadgeCheck,
  Building2,
  CalendarCheck,
  CalendarClock,
  Calculator,
  Cloud,
  Cpu,
  Database,
  FileSpreadsheet,
  GitBranch,
  Globe,
  Gauge,
  Layers,
  Landmark,
  Lock,
  Receipt,
  Send,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Workflow,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Brand } from "@/components/landing/Brand"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RESERVAR_DEMO_ROUTE } from "@/lib/demo"
import { URL_SITIO_PUBLICO } from "@/lib/site"
import {
  ETIQUETA_PLAN,
  LIMITE_ESPECIALISTAS_PLAN,
  PLANES_TENANT,
  PRECIO_PLAN_ANUAL_USD,
  PRECIO_PLAN_USD,
} from "@/lib/suscripcion"
import { RESERVAS_GRATIS_LIMITE } from "@/lib/trial"
import { ROL_LABEL } from "@/lib/rbac"
import type { PlanTenant, TenantUserRole } from "@/types/database"

export const metadata: Metadata = {
  title: "Proceso y Arquitectura del SaaS | Medisys",
  description:
    "Cómo está construido Medisys: SaaS multi-tenant para clínicas en Venezuela con Next.js 16, Supabase (RLS), suite fiscal SENIAT (tasa BCV, IVA e IGTF), seguridad por roles y cero dependencias de IA en runtime.",
}

/* ------------------------------------------------------------------ */
/* Datos comerciales y de referencia (placeholders centralizados)      */
/* ------------------------------------------------------------------ */

/** Repositorio oficial del proyecto: fuente de esta documentación. */
const GITHUB_URL = "https://github.com/jggalviz/medisys"

/** WhatsApp de ventas / onboarding. */
const WHATSAPP_NUMBER = "584228101010"
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hola Medisys 👋, quiero conocer el proceso de desarrollo y la arquitectura del SaaS."
)}`

const SALES_EMAIL = "ventas@vortex.com.ve"
const COMPANY_NAME = "Vortex Logic Microsystems"
const COMPANY_URL = "https://vortex.com.ve"

/* ------------------------------------------------------------------ */
/* Helpers de layout                                                   */
/* ------------------------------------------------------------------ */

function Container({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-6 lg:px-8", className)}>
      {children}
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string
  title: string
  description: string
  icon: LucideIcon
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-700">
        <Icon className="size-3.5" aria-hidden="true" />
        {eyebrow}
      </span>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-base leading-7 text-zinc-600">{description}</p>
    </div>
  )
}

/** Estilos compartidos de las tablas comparativas. */
const thClass =
  "whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-zinc-500"
const tdClass = "px-4 py-3 align-top text-sm leading-6 text-zinc-700"

/* ------------------------------------------------------------------ */
/* 1 · Propuesta de valor                                              */
/* ------------------------------------------------------------------ */

const KPIS: readonly { label: string; value: string; hint: string }[] = [
  { label: "Modelo", value: "Multi-tenant", hint: "Aislado por RLS" },
  { label: "Reservas", value: "24/7", hint: "Enlace permanente" },
  { label: "Tasa BCV", value: "1×/día", hint: "Cron 12:00 UTC" },
  { label: "Accesos", value: "5 roles", hint: "21 permisos" },
  { label: "IA en runtime", value: "0", hint: "Código determinista" },
]

type Pilar = {
  icon: LucideIcon
  acento: string
  chip: string
  title: string
  description: string
}

const PILARES: readonly Pilar[] = [
  {
    icon: Building2,
    acento: "bg-teal-500/10 text-teal-600 ring-teal-500/15",
    chip: "Multi-tenant",
    title: "Un SaaS para clínicas, centros e independientes",
    description:
      "Cada cliente corre aislado sobre el mismo despliegue: clínicas multi-sede, grupos médicos o consultorios de un solo profesional, todos en Venezuela.",
  },
  {
    icon: CalendarCheck,
    acento: "bg-sky-500/10 text-sky-600 ring-sky-500/15",
    chip: "24/7",
    title: "Agendamiento automático sin call center",
    description:
      "Enlace permanente de reserva y perfil público: el paciente elige especialista, fecha y turno desde el navegador, a cualquier hora del día.",
  },
  {
    icon: Globe,
    acento: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/15",
    chip: "SEO local",
    title: "Perfiles públicos optimizados para Google",
    description:
      "Cada tenant expone una página indexable con metadatos propios por clínica, para captar pacientes desde búsquedas locales sin publicidad.",
  },
  {
    icon: Smartphone,
    acento: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/15",
    chip: "Pago Móvil",
    title: "Comprobante y validación en tiempo real",
    description:
      "El paciente sube el comprobante con su referencia; recepción lo compara contra sus movimientos bancarios y confirma la cita en el acto.",
  },
]

/* ------------------------------------------------------------------ */
/* 2 · Arquitectura técnica y stack                                    */
/* ------------------------------------------------------------------ */

type TechCard = {
  icon: LucideIcon
  acento: string
  tag: string
  title: string
  description: string
  bullets: readonly string[]
}

const STACK: readonly TechCard[] = [
  {
    icon: Workflow,
    acento: "bg-zinc-900 text-white",
    tag: "Next.js 16",
    title: "Una sola unidad de despliegue",
    description:
      "Toda la aplicación — interfaz, lógica de negocio y API — vive en un único proyecto de Next.js desplegado en Vercel. Sin backend separado que construir, asegurar o escalar.",
    bullets: [
      "App Router con React Server Components",
      "Server Actions para mutaciones validadas en el servidor",
      "Route Handlers para la API interna (/api/admin/*)",
      "proxy.ts (el Middleware de Next.js 16) protege las rutas privadas",
    ],
  },
  {
    icon: Database,
    acento: "bg-emerald-600 text-white",
    tag: "Supabase Postgres",
    title: "Una única fuente de verdad",
    description:
      "El esquema Postgres, la autenticación, el almacenamiento y las políticas de Row Level Security viven en Supabase. Ningún otro servicio guarda estado.",
    bullets: [
      "Row Level Security (RLS) por tenant en cada tabla",
      "Supabase Auth con sesión por cookies verificada en servidor",
      "Supabase Storage para logos, comprobantes y recursos de marca",
      "Migraciones SQL versionadas en supabase/migrations",
    ],
  },
  {
    icon: Gauge,
    acento: "bg-teal-600 text-white",
    tag: "Tailwind v4 + shadcn/ui",
    title: "Interfaz consistente y ligera",
    description:
      "El sistema de diseño se apoya en Tailwind CSS v4 y en componentes shadcn/ui accesibles, con tokens de tema que permiten el branding de cada clínica.",
    bullets: [
      "Componentes base reutilizados (Card, Badge, Alert, Button…)",
      "Tokens de tema por tenant (color, tipografía, logotipo)",
      "Diseño responsive-first e iconografía Lucide",
    ],
  },
  {
    icon: Cpu,
    acento: "bg-amber-500 text-white",
    tag: "Determinista",
    title: "Cero dependencias de IA en runtime",
    description:
      "No hay modelos ni llamadas a proveedores de IA en producción. Los cálculos fiscales y contables son funciones puras, reproducibles y auditables por el SENIAT.",
    bullets: [
      "Motores en src/lib/*-ve.ts sin efectos secundarios",
      "Misma entrada ⇒ mismo resultado (trazable en cada cierre)",
      "La IA queda como roadmap, nunca en el camino crítico",
    ],
  },
]

const COMPARATIVA_ARQUITECTURA: readonly {
  aspecto: string
  medisys: string
  tradicional: string
}[] = [
  {
    aspecto: "Unidades de despliegue",
    medisys: "1 proyecto Next.js en Vercel",
    tradicional: "Frontend + backend + workers + cron separados",
  },
  {
    aspecto: "Fuente de verdad",
    medisys: "Supabase Postgres (esquema + RLS)",
    tradicional: "API propia sobre una base de datos gestionada aparte",
  },
  {
    aspecto: "Autenticación",
    medisys: "Supabase Auth con cookies verificadas en el servidor",
    tradicional: "Servicio de auth propio o integración adicional",
  },
  {
    aspecto: "Aislamiento por cliente",
    medisys: "RLS + multi-tenant en la misma base de datos",
    tradicional: "Instancias o esquemas dedicados por cliente",
  },
  {
    aspecto: "Tareas programadas",
    medisys: "Vercel Cron → /api/cron/bcv-rate",
    tradicional: "Workers o servidores de cron dedicados",
  },
  {
    aspecto: "Cálculos fiscales",
    medisys: "Funciones puras y deterministas (sin IA)",
    tradicional: "Procesos manuales o servicios externos",
  },
]

/* ------------------------------------------------------------------ */
/* 3 · Cumplimiento normativo y suite fiscal (SENIAT)                  */
/* ------------------------------------------------------------------ */

const CASCADA_BCV: readonly {
  paso: string
  title: string
  description: string
  icon: LucideIcon
}[] = [
  {
    paso: "1",
    icon: Globe,
    title: "Scraping del portal del BCV",
    description:
      "Se lee la tasa oficial del día directamente de bcv.org.ve (etiqueta USD) con un User-Agent de navegador real para evitar bloqueos.",
  },
  {
    paso: "2",
    icon: Cloud,
    title: "APIs públicas de respaldo",
    description:
      "Si el portal no responde o cambió su marcado, se consultan las APIs de dolarapi.com y pydolarve.org como segunda fuente.",
  },
  {
    paso: "3",
    icon: Database,
    title: "Última tasa en base de datos",
    description:
      "Si las fuentes externas fallan, se reutiliza la última fila válida guardada en la tabla bcv_rates, incluida la carga manual.",
  },
  {
    paso: "4",
    icon: ShieldCheck,
    title: "Valor de respaldo seguro",
    description:
      "Como último recurso existe una constante de seguridad para que la plataforma nunca se quede sin tasa para facturar.",
  },
]

const TABLA_IMPUESTOS: readonly {
  impuesto: string
  alicuota: string
  base: string
  nota: string
}[] = [
  {
    impuesto: "IVA",
    alicuota: "16%",
    base: "Servicios gravados",
    nota: "Alícuota general aplicada a los servicios administrativos y al plan SaaS.",
  },
  {
    impuesto: "Exento",
    alicuota: "0%",
    base: "Servicios médicos directos",
    nota: "Consultas y actos médicos directos se facturan exentos (Ley de IVA).",
  },
  {
    impuesto: "IGTF",
    alicuota: "3%",
    base: "Cobros en divisas / efectivo extranjero",
    nota: "Se aplica a Zelle y efectivo en USD; no al Pago Móvil ni a bolívares.",
  },
]

const METODOS_PAGO: readonly {
  metodo: string
  moneda: string
  igtf: string
  detalle: string
}[] = [
  {
    metodo: "Pago Móvil",
    moneda: "VES",
    igtf: "No",
    detalle: "Transferencia inmediata en bolívares desde la banca en línea.",
  },
  {
    metodo: "Transferencia (Bs.)",
    moneda: "VES",
    igtf: "No",
    detalle: "Transferencia bancaria nacional en bolívares.",
  },
  {
    metodo: "Punto de venta",
    moneda: "VES",
    igtf: "No",
    detalle: "Débito/crédito nacional procesado en bolívares.",
  },
  {
    metodo: "Efectivo (Bs.)",
    moneda: "VES",
    igtf: "No",
    detalle: "Efectivo en bolívares al tipo de cambio del día.",
  },
  {
    metodo: "Zelle",
    moneda: "USD",
    igtf: "Sí · 3%",
    detalle: "Pago en divisas: genera IGTF sobre el monto cobrado.",
  },
  {
    metodo: "Efectivo (USD)",
    moneda: "USD",
    igtf: "Sí · 3%",
    detalle: "Efectivo en divisas extranjeras: genera IGTF.",
  },
]

const MODULOS_FISCALES: readonly {
  icon: LucideIcon
  title: string
  description: string
}[] = [
  {
    icon: Landmark,
    title: "Motor de tasa BCV",
    description:
      "Cascada de fuentes con caché de 1 hora y cron diario a las 12:00 UTC (vercel.json).",
  },
  {
    icon: Receipt,
    title: "Facturación dual USD / VES",
    description:
      "Toda factura guarda su equivalente en bolívares a la tasa del día, sin ambigüedad contable.",
  },
  {
    icon: Calculator,
    title: "Controladores fiscales",
    description:
      "Cálculo de IVA (16% / exento) e IGTF (3%) centralizado en un único módulo auditable.",
  },
  {
    icon: FileSpreadsheet,
    title: "Libro de Ventas SENIAT",
    description:
      "Exportación en CSV del libro de ventas con los campos exigidos por la administración tributaria.",
  },
  {
    icon: Wallet,
    title: "Arqueo de caja diario",
    description:
      "Cierre por método de pago (Pago Móvil, Zelle, efectivo, punto) con su equivalente en Bs y USD.",
  },
  {
    icon: Users,
    title: "Liquidación de honorarios",
    description:
      "Reparto por especialista según su porcentaje, calculado sobre los servicios efectivamente cobrados.",
  },
]

/* ------------------------------------------------------------------ */
/* 4 · Seguridad, roles y multi-tenancy                                */
/* ------------------------------------------------------------------ */

const CAPAS_SEGURIDAD: readonly {
  capa: string
  icon: LucideIcon
  title: string
  description: string
}[] = [
  {
    capa: "Capa 1",
    icon: Database,
    title: "Row Level Security en la base de datos",
    description:
      "Cada fila se filtra en Postgres por tenant y por sede según la membresía de la sesión. Sin una política válida, la consulta no devuelve datos aunque el código de aplicación fallara.",
  },
  {
    capa: "Capa 2",
    icon: Workflow,
    title: "Server Actions validadas",
    description:
      "Toda mutación del panel resuelve la sesión, comprueba la membresía del tenant y exige el permiso RBAC antes de escribir en la base de datos.",
  },
  {
    capa: "Capa 3",
    icon: Server,
    title: "Route Handlers protegidos",
    description:
      "La API /api/admin/* obtiene el contexto con resolverContextoAdmin y responde 401/403 automáticamente cuando falta sesión o permiso.",
  },
]

const ROLES_RESUMEN: readonly {
  key: string
  icon: LucideIcon
  acento: string
  alcance: string
}[] = [
  {
    key: "admin",
    icon: ShieldCheck,
    acento: "bg-teal-500/10 text-teal-600 ring-teal-500/15",
    alcance:
      "Control total: configuración fiscal, sedes, catálogo, cobros, facturación y equipo.",
  },
  {
    key: "recepcion",
    icon: CalendarClock,
    acento: "bg-sky-500/10 text-sky-600 ring-sky-500/15",
    alcance:
      "Agenda, verificación de comprobantes, cobros en caja y cierres de contabilidad.",
  },
  {
    key: "medico",
    icon: TrendingUp,
    acento: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/15",
    alcance:
      "Su propia agenda y sus consultas: atiende pacientes y ve su facturación.",
  },
  {
    key: "especialista",
    icon: TrendingUp,
    acento: "bg-violet-500/10 text-violet-600 ring-violet-500/15",
    alcance:
      "Alias operativo del rol Médico (histórico) en la agenda y el portal clínico.",
  },
  {
    key: "contador",
    icon: Calculator,
    acento: "bg-amber-500/10 text-amber-600 ring-amber-500/15",
    alcance:
      "Perfil fiscal/financiero: tasas, reportes, auditoría y liquidación de honorarios.",
  },
]

/** Los 21 permisos granulares del panel administrativo (rbac.ts). */
const PERMISOS: readonly { grupo: string; items: readonly string[] }[] = [
  {
    grupo: "Configuración",
    items: ["configuracion:leer", "configuracion:escribir"],
  },
  { grupo: "Fiscal", items: ["fiscal:leer", "fiscal:escribir"] },
  { grupo: "Tasa BCV", items: ["tasa:leer", "tasa:escribir"] },
  { grupo: "Catálogo", items: ["servicios:leer", "servicios:escribir"] },
  { grupo: "Sedes", items: ["sedes:leer", "sedes:escribir"] },
  { grupo: "Equipo", items: ["usuarios:escribir"] },
  { grupo: "Cobros", items: ["cobros:recaudar", "cobros:registrar"] },
  {
    grupo: "Facturación",
    items: ["facturacion:leer", "facturacion:emitir", "facturacion:anular"],
  },
  {
    grupo: "Contabilidad",
    items: ["contabilidad:leer", "contabilidad:escribir"],
  },
  { grupo: "Honorarios", items: ["honorarios:leer", "honorarios:escribir"] },
  { grupo: "Consulta", items: ["consulta:atender"] },
]

/** Resumen editorial por plan (precios y cupos vienen de lib/suscripcion.ts). */
const DESCRIPCION_PLAN: Record<
  PlanTenant,
  { resumen: string; sedes: string; destacado: boolean }
> = {
  INDIVIDUAL: {
    resumen: "Consultorio de un solo profesional, con agenda y cobros propios.",
    sedes: "1 sede",
    destacado: false,
  },
  PYME: {
    resumen: "Grupo médico en crecimiento con varios especialistas.",
    sedes: "Varias sedes",
    destacado: true,
  },
  PRO: {
    resumen: "Clínica o red con múltiples sedes y equipos de trabajo.",
    sedes: "Multi-sede",
    destacado: false,
  },
}

/* ------------------------------------------------------------------ */
/* 5 · Enlaces y CTAs                                                  */
/* ------------------------------------------------------------------ */

const ENLACES: readonly {
  icon: LucideIcon
  acento: string
  title: string
  description: string
  href: string
  cta: string
  external: boolean
}[] = [
  {
    icon: GitBranch,
    acento: "bg-zinc-900 text-white",
    title: "Repositorio en GitHub",
    description:
      "Código fuente, migraciones de Supabase y documentación técnica completa del desarrollo.",
    href: GITHUB_URL,
    cta: "Explorar el código",
    external: true,
  },
  {
    icon: CalendarCheck,
    acento: "bg-teal-600 text-white",
    title: "Demo en vivo",
    description:
      "Recorre el wizard de reserva del paciente y el panel de la clínica de demostración.",
    href: RESERVAR_DEMO_ROUTE,
    cta: "Abrir la demo",
    external: false,
  },
  {
    icon: Send,
    acento: "bg-emerald-600 text-white",
    title: "Habla con el equipo",
    description:
      "Onboarding, migración de datos y cualquier detalle técnico de la arquitectura.",
    href: WHATSAPP_URL,
    cta: "Escribir por WhatsApp",
    external: true,
  },
]

/* ------------------------------------------------------------------ */
/* Barra superior                                                      */
/* ------------------------------------------------------------------ */

const NAV_ANCHORS: readonly { href: string; label: string }[] = [
  { href: "#vision", label: "Visión" },
  { href: "#arquitectura", label: "Arquitectura" },
  { href: "#fiscal", label: "Fiscal SENIAT" },
  { href: "#seguridad", label: "Seguridad" },
  { href: "#enlaces", label: "Recursos" },
]

function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/85 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Brand />
          <span className="hidden rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500 sm:inline-flex">
            Proceso &amp; Arquitectura
          </span>
        </div>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Secciones">
          {NAV_ANCHORS.map((anchor) => (
            <a
              key={anchor.href}
              href={anchor.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              {anchor.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="hidden text-sm font-semibold text-zinc-600 transition-colors hover:text-teal-700 sm:inline-flex"
          >
            Ir al inicio
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-900 px-3.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            <GitBranch className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </Container>
    </header>
  )
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_-2%,rgba(20,184,166,0.14),transparent_70%)]" />
        <div className="absolute -top-32 right-[-10%] size-[30rem] rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute bottom-[-12rem] left-[-8rem] size-[26rem] rounded-full bg-teal-300/20 blur-3xl" />
      </div>

      <Container className="py-16 sm:py-20 lg:py-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <span className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-teal-800 sm:text-xs">
            <Sparkles className="size-3.5 text-teal-500" aria-hidden="true" />
            Documentación técnica del producto
          </span>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-zinc-900 sm:text-5xl xl:text-[3.4rem]">
            El proceso y la arquitectura de{" "}
            <span className="bg-linear-to-r from-teal-600 via-cyan-600 to-sky-600 bg-clip-text text-transparent">
              Medisys
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
            Cómo un único proyecto de Next.js 16 con Supabase se convierte en un
            SaaS multi-tenant que agenda 24/7, cobra en USD y VES a la tasa
            oficial del BCV y cumple con el SENIAT — sin dependencias de IA en el
            camino crítico.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 text-base font-semibold text-white transition hover:bg-zinc-800"
            >
              <GitBranch className="size-5" aria-hidden="true" />
              Repositorio en GitHub
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
            <Link
              href={RESERVAR_DEMO_ROUTE}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 text-base font-semibold text-zinc-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50/40"
            >
              <CalendarCheck className="size-4 text-teal-600" aria-hidden="true" />
              Ver demo en vivo
            </Link>
          </div>
        </div>

        <dl className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {KPIS.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm"
            >
              <dt className="font-mono text-[11px] uppercase tracking-wide text-zinc-500">
                {kpi.label}
              </dt>
              <dd className="mt-1 text-xl font-bold tracking-tight text-zinc-900">
                {kpi.value}
              </dd>
              <dd className="mt-0.5 text-xs text-zinc-500">{kpi.hint}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 1 · Visión general y propuesta de valor                             */
/* ------------------------------------------------------------------ */

function VisionSection() {
  return (
    <section id="vision" className="scroll-mt-20 border-t border-zinc-100">
      <Container className="py-16 sm:py-20">
        <SectionHeading
          icon={Sparkles}
          eyebrow="Visión general"
          title="Un SaaS hecho a la medida del mercado venezolano"
          description="Medisys concentra en una sola plataforma la operación diaria de una clínica y el cumplimiento fiscal que exige el país, sin depender de integraciones externas frágiles."
        />

        <div className="mx-auto mt-10 max-w-4xl rounded-2xl border border-teal-200 bg-linear-to-br from-teal-50 to-cyan-50 p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wide text-teal-700">
            Short pitch
          </p>
          <p className="mt-3 text-lg leading-8 text-zinc-800">
            SaaS multi-tenant para clínicas, centros médicos y profesionales
            independientes en Venezuela: automatiza las citas 24/7 con perfiles
            públicos optimizados para SEO, permite al paciente subir su
            comprobante de <strong className="font-semibold">Pago Móvil</strong> y
            deja que recepción lo valide en tiempo real — todo con facturación y
            contabilidad listas para el SENIAT.
          </p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PILARES.map((pilar) => (
            <Card
              key={pilar.title}
              className="h-full gap-3 transition hover:-translate-y-1 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-900/5"
            >
              <CardHeader>
                <span
                  className={cn(
                    "flex size-11 items-center justify-center rounded-xl ring-1",
                    pilar.acento
                  )}
                >
                  <pilar.icon className="size-5" aria-hidden="true" />
                </span>
                <Badge
                  variant="secondary"
                  className="mt-3 w-fit bg-zinc-100 text-[10px] font-semibold uppercase tracking-wide text-zinc-500"
                >
                  {pilar.chip}
                </Badge>
                <CardTitle className="text-base font-bold leading-snug text-zinc-900">
                  {pilar.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-zinc-600">
                  {pilar.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 2 · Arquitectura técnica y stack                                    */
/* ------------------------------------------------------------------ */

function ArchSection() {
  return (
    <section
      id="arquitectura"
      className="scroll-mt-20 border-t border-zinc-100 bg-zinc-50/60"
    >
      <Container className="py-16 sm:py-20">
        <SectionHeading
          icon={Layers}
          eyebrow="Arquitectura técnica"
          title="Un stack pequeño, moderno y auditable"
          description="Menos piezas móviles significa menos superficie de error, menos costes de operación y una historia de cumplimiento más fácil de defender ante el SENIAT."
        />

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {STACK.map((tech) => (
            <Card key={tech.tag} className="h-full bg-white">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "flex size-11 items-center justify-center rounded-xl",
                      tech.acento
                    )}
                  >
                    <tech.icon className="size-5" aria-hidden="true" />
                  </span>
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] uppercase tracking-wide text-zinc-500"
                  >
                    {tech.tag}
                  </Badge>
                </div>
                <CardTitle className="mt-1 text-lg font-bold text-zinc-900">
                  {tech.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-zinc-600">
                  {tech.description}
                </p>
                <ul className="space-y-2">
                  {tech.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-2 text-sm leading-6 text-zinc-700"
                    >
                      <BadgeCheck
                        className="mt-1 size-4 shrink-0 text-teal-600"
                        aria-hidden="true"
                      />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <DiagramaArquitectura />
        <TablaArquitectura />
      </Container>
    </section>
  )
}

function DiagramaArquitectura() {
  const niveles: readonly {
    icon: LucideIcon
    titulo: string
    detalle: string
    items: readonly string[]
    acento: string
  }[] = [
    {
      icon: Smartphone,
      titulo: "Cliente · navegador",
      detalle: "Interfaces por rol sobre el mismo dominio",
      items: [
        "Reserva pública del paciente",
        "Panel de recepción y administración",
        "Portal del especialista",
      ],
      acento: "bg-sky-600 text-white",
    },
    {
      icon: Workflow,
      titulo: "Vercel · Next.js 16 (una sola unidad de despliegue)",
      detalle: "Render, lógica de negocio y API en el mismo proyecto",
      items: [
        "Server Components",
        "Server Actions",
        "Route Handlers · /api/admin/*",
        "proxy.ts · protección de rutas",
        "Cron 12:00 UTC → /api/cron/bcv-rate",
      ],
      acento: "bg-zinc-900 text-white",
    },
    {
      icon: Database,
      titulo: "Supabase · única fuente de verdad",
      detalle: "Postgres gestionado con seguridad a nivel de fila",
      items: [
        "Postgres + Row Level Security",
        "Auth con sesión por cookies",
        "Storage de comprobantes y logos",
        "Tabla bcv_rates (tasa histórica)",
      ],
      acento: "bg-emerald-600 text-white",
    },
  ]

  return (
    <div className="mt-12">
      <h3 className="text-center text-sm font-bold uppercase tracking-wide text-zinc-500">
        Diagrama de capas
      </h3>
      <div className="mx-auto mt-6 flex max-w-3xl flex-col items-stretch">
        {niveles.map((nivel, index) => (
          <div key={nivel.titulo}>
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    nivel.acento
                  )}
                >
                  <nivel.icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-zinc-900">
                    {nivel.titulo}
                  </p>
                  <p className="text-xs text-zinc-500">{nivel.detalle}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {nivel.items.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
            {index < niveles.length - 1 && (
              <div className="flex justify-center py-1.5" aria-hidden="true">
                <ArrowDown className="size-4 text-zinc-300" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function TablaArquitectura() {
  return (
    <div className="mt-12">
      <h3 className="text-center text-sm font-bold uppercase tracking-wide text-zinc-500">
        Medisys frente a una arquitectura tradicional por servicios
      </h3>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead className="bg-zinc-50">
            <tr>
              <th className={thClass}>Aspecto</th>
              <th className={cn(thClass, "text-teal-700")}>Medisys</th>
              <th className={thClass}>Arquitectura tradicional</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {COMPARATIVA_ARQUITECTURA.map((fila) => (
              <tr key={fila.aspecto}>
                <th
                  scope="row"
                  className={cn(tdClass, "font-semibold text-zinc-900")}
                >
                  {fila.aspecto}
                </th>
                <td className={cn(tdClass, "font-medium text-teal-800")}>
                  {fila.medisys}
                </td>
                <td className={tdClass}>{fila.tradicional}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 3 · Cumplimiento normativo y suite fiscal (SENIAT)                  */
/* ------------------------------------------------------------------ */

function FiscalSection() {
  return (
    <section id="fiscal" className="scroll-mt-20 border-t border-zinc-100">
      <Container className="py-16 sm:py-20">
        <SectionHeading
          icon={Landmark}
          eyebrow="Cumplimiento SENIAT"
          title="Suite fiscal lista para facturar en bolívares y divisas"
          description="Tasa oficial, IVA e IGTF, libro de ventas, arqueo de caja y honorarios: todo calculado por funciones puras que pueden auditarse línea por línea."
        />

        <CascadaBcv />

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <TablaImpuestos />
          <TablaMetodosPago />
        </div>

        <ModulosFiscalesGrid />
      </Container>
    </section>
  )
}

function CascadaBcv() {
  return (
    <div className="mt-10 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white">
            <TrendingUp className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-lg font-bold text-zinc-900">
              Motor de tasa BCV con cascada de respaldo
            </h3>
            <p className="text-sm text-zinc-500">
              La plataforma nunca deja de facturar por una fuente caída.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-teal-600 text-white">Caché de 1 hora</Badge>
          <Badge
            variant="outline"
            className="border-zinc-300 bg-white text-zinc-600"
          >
            Cron diario 12:00 UTC
          </Badge>
        </div>
      </div>

      <ol className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {CASCADA_BCV.map((paso) => (
          <li
            key={paso.paso}
            className="relative rounded-xl border border-zinc-200 bg-white p-4"
          >
            <span className="absolute -top-3 left-4 inline-flex size-6 items-center justify-center rounded-full bg-zinc-900 font-mono text-xs font-bold text-white">
              {paso.paso}
            </span>
            <paso.icon
              className="mt-2 size-5 text-teal-600"
              aria-hidden="true"
            />
            <p className="mt-2 text-sm font-bold text-zinc-900">{paso.title}</p>
            <p className="mt-1 text-xs leading-5 text-zinc-600">
              {paso.description}
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}

function TablaImpuestos() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-zinc-100 p-5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/15">
          <Receipt className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-zinc-900">Impuestos aplicados</h3>
          <p className="text-xs text-zinc-500">
            IVA e IGTF calculados siempre en el servidor
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/60">
              <th className={thClass}>Concepto</th>
              <th className={thClass}>Alícuota</th>
              <th className={thClass}>Nota</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {TABLA_IMPUESTOS.map((fila) => (
              <tr key={fila.impuesto}>
                <th
                  scope="row"
                  className={cn(tdClass, "font-semibold text-zinc-900")}
                >
                  {fila.impuesto}
                  <span className="mt-0.5 block text-xs font-normal text-zinc-500">
                    {fila.base}
                  </span>
                </th>
                <td
                  className={cn(tdClass, "font-mono font-semibold text-teal-700")}
                >
                  {fila.alicuota}
                </td>
                <td className={cn(tdClass, "text-xs leading-5 text-zinc-600")}>
                  {fila.nota}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TablaMetodosPago() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-zinc-100 p-5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/15">
          <Banknote className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-zinc-900">
            Métodos de cobro y su IGTF
          </h3>
          <p className="text-xs text-zinc-500">
            El IGTF (3%) se aplica solo a pagos en divisas o efectivo extranjero
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/60">
              <th className={thClass}>Método</th>
              <th className={thClass}>Moneda</th>
              <th className={thClass}>IGTF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {METODOS_PAGO.map((fila) => (
              <tr key={fila.metodo}>
                <th
                  scope="row"
                  className={cn(tdClass, "font-semibold text-zinc-900")}
                >
                  {fila.metodo}
                  <span className="mt-0.5 block text-xs font-normal text-zinc-500">
                    {fila.detalle}
                  </span>
                </th>
                <td className={tdClass}>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono text-[10px]",
                      fila.moneda === "USD"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600"
                    )}
                  >
                    {fila.moneda}
                  </Badge>
                </td>
                <td className={tdClass}>
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      fila.igtf === "No" ? "text-zinc-400" : "text-amber-600"
                    )}
                  >
                    {fila.igtf}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ModulosFiscalesGrid() {
  return (
    <div className="mt-12">
      <h3 className="text-center text-sm font-bold uppercase tracking-wide text-zinc-500">
        Módulos de la suite fiscal y contable
      </h3>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS_FISCALES.map((modulo) => (
          <Card key={modulo.title} className="h-full gap-2 bg-white">
            <CardHeader>
              <span className="flex size-10 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/15">
                <modulo.icon className="size-5" aria-hidden="true" />
              </span>
              <CardTitle className="text-sm font-bold text-zinc-900">
                {modulo.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs leading-5 text-zinc-600">
                {modulo.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 4 · Seguridad, roles y multi-tenancy                                */
/* ------------------------------------------------------------------ */

function SecuritySection() {
  return (
    <section
      id="seguridad"
      className="scroll-mt-20 border-t border-zinc-100 bg-zinc-50/60"
    >
      <Container className="py-16 sm:py-20">
        <SectionHeading
          icon={ShieldCheck}
          eyebrow="Seguridad y multi-tenancy"
          title="Cada clínica ve solo lo suyo, en las tres capas"
          description="El aislamiento no depende de una sola comprobación: la base de datos, las mutaciones y la API aplican la misma regla por separado."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {CAPAS_SEGURIDAD.map((capa) => (
            <Card key={capa.capa} className="h-full bg-white">
              <CardHeader>
                <Badge
                  variant="outline"
                  className="w-fit border-teal-200 bg-teal-50 font-mono text-[10px] uppercase tracking-wide text-teal-700"
                >
                  {capa.capa}
                </Badge>
                <span className="mt-2 flex size-10 items-center justify-center rounded-lg bg-zinc-900 text-white">
                  <capa.icon className="size-5" aria-hidden="true" />
                </span>
                <CardTitle className="text-base font-bold text-zinc-900">
                  {capa.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-zinc-600">
                  {capa.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <TablaRoles />
        <PermisosGrid />
        <MultiSedeCallout />
        <TablaPlanes />
      </Container>
    </section>
  )
}

function TablaRoles() {
  return (
    <div className="mt-12">
      <h3 className="text-center text-sm font-bold uppercase tracking-wide text-zinc-500">
        Roles del personal (5) y su alcance
      </h3>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead className="bg-zinc-50">
            <tr>
              <th className={thClass}>Rol</th>
              <th className={thClass}>Identificador</th>
              <th className={thClass}>Alcance principal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {ROLES_RESUMEN.map((rol) => (
              <tr key={rol.key}>
                <th scope="row" className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg ring-1",
                        rol.acento
                      )}
                    >
                      <rol.icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold text-zinc-900">
                      {ROL_LABEL[rol.key as TenantUserRole]}
                    </span>
                  </span>
                </th>
                <td className={cn(tdClass, "font-mono text-xs text-zinc-500")}>
                  {rol.key}
                </td>
                <td className={cn(tdClass, "text-xs leading-5 text-zinc-600")}>
                  {rol.alcance}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PermisosGrid() {
  return (
    <div className="mt-12 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/15">
            <Users className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-zinc-900">
              21 permisos granulares
            </h3>
            <p className="text-xs text-zinc-500">
              Cada acción del panel exige un permiso explícito del rol.
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="border-zinc-200 bg-zinc-50 font-mono text-[10px] text-zinc-500"
        >
          src/lib/rbac.ts
        </Badge>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PERMISOS.map((grupo) => (
          <div
            key={grupo.grupo}
            className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              {grupo.grupo}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {grupo.items.map((item) => (
                <span
                  key={item}
                  className="rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-zinc-600"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MultiSedeCallout() {
  return (
    <div className="mt-12 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-2xl border border-teal-200 bg-linear-to-br from-teal-50 to-cyan-50 p-6 sm:p-8">
        <span className="flex size-10 items-center justify-center rounded-xl bg-teal-600 text-white">
          <Lock className="size-5" aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-lg font-bold text-zinc-900">
          Aislamiento por tenant y por sede
        </h3>
        <ul className="mt-4 space-y-2.5 text-sm leading-6 text-zinc-700">
          <li className="flex gap-2">
            <BadgeCheck
              className="mt-1 size-4 shrink-0 text-teal-600"
              aria-hidden="true"
            />
            <span>
              Cada fila lleva su{" "}
              <code className="font-mono text-[13px]">tenant_id</code>: una
              consulta mal formada no puede leer datos de otra clínica.
            </span>
          </li>
          <li className="flex gap-2">
            <BadgeCheck
              className="mt-1 size-4 shrink-0 text-teal-600"
              aria-hidden="true"
            />
            <span>
              El personal se asocia a la clínica en{" "}
              <code className="font-mono text-[13px]">tenant_users</code> con un
              rol y una lista de sedes.
            </span>
          </li>
          <li className="flex gap-2">
            <BadgeCheck
              className="mt-1 size-4 shrink-0 text-teal-600"
              aria-hidden="true"
            />
            <span>
              Una lista de sedes vacía equivale a acceso a todas las sedes del
              tenant (compatibilidad hacia atrás).
            </span>
          </li>
          <li className="flex gap-2">
            <BadgeCheck
              className="mt-1 size-4 shrink-0 text-teal-600"
              aria-hidden="true"
            />
            <span>
              La sesión se resuelve en el servidor con cookies de Supabase Auth;
              nunca se confía en datos enviados por el cliente.
            </span>
          </li>
        </ul>
      </div>

      <div className="flex flex-col justify-center rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wide text-teal-700">
          Sin riesgo para probar
        </p>
        <h3 className="mt-2 text-lg font-bold text-zinc-900">
          {RESERVAS_GRATIS_LIMITE} reservas de cortesía por clínica
        </h3>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Cada tenant nuevo agenda sin coste hasta consumir su contador de
          cortesía; al superarlo se activa el plan elegido. El contador se evalúa
          antes de cada reserva, de forma atómica en el servidor.
        </p>
        <div className="mt-5 grid grid-cols-10 gap-1" aria-hidden="true">
          {Array.from({ length: RESERVAS_GRATIS_LIMITE }).map((_, index) => (
            <span
              key={index}
              className="h-6 rounded-sm border border-teal-300 bg-teal-50"
            />
          ))}
        </div>
        <p className="mt-3 font-mono text-xs text-zinc-500">
          consumidas / {RESERVAS_GRATIS_LIMITE} · src/lib/trial.ts
        </p>
      </div>
    </div>
  )
}

function TablaPlanes() {
  return (
    <div className="mt-12">
      <h3 className="text-center text-sm font-bold uppercase tracking-wide text-zinc-500">
        Planes comerciales y sus límites
      </h3>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {PLANES_TENANT.map((plan) => {
          const limite = LIMITE_ESPECIALISTAS_PLAN[plan]
          const rango =
            limite.max === null
              ? `${limite.min}+`
              : limite.min === limite.max
                ? `${limite.min}`
                : `${limite.min} – ${limite.max}`
          const meta = DESCRIPCION_PLAN[plan]

          return (
            <div
              key={plan}
              className={cn(
                "flex h-full flex-col rounded-2xl border bg-white p-6 shadow-sm",
                meta.destacado
                  ? "border-teal-300 ring-2 ring-teal-500/15"
                  : "border-zinc-200"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-base font-bold text-zinc-900">
                  {ETIQUETA_PLAN[plan]}
                </h4>
                {meta.destacado && (
                  <Badge className="bg-teal-600 text-white">Más elegido</Badge>
                )}
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-600">
                {meta.resumen}
              </p>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-zinc-900">
                  ${PRECIO_PLAN_USD[plan]}
                </span>
                <span className="text-sm text-zinc-500">/ mes</span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Anual:{" "}
                <span className="font-semibold text-zinc-700">
                  ${PRECIO_PLAN_ANUAL_USD[plan]}
                </span>{" "}
                (2 meses de ahorro)
              </p>
              <dl className="mt-5 space-y-2 border-t border-zinc-100 pt-4 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-zinc-500">Especialistas</dt>
                  <dd className="font-semibold text-zinc-800">{rango}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-zinc-500">Sedes</dt>
                  <dd className="font-semibold text-zinc-800">{meta.sedes}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-zinc-500">Identificador</dt>
                  <dd className="font-mono text-[11px] text-zinc-500">{plan}</dd>
                </div>
              </dl>
            </div>
          )
        })}
      </div>
      <p className="mt-4 text-center text-xs text-zinc-500">
        Precios y cupos definidos en{" "}
        <span className="font-mono">src/lib/suscripcion.ts</span>; cada
        renovación aprobada suma 30 días de servicio.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 5 · Enlaces y recursos                                              */
/* ------------------------------------------------------------------ */

const tarjetaEnlaceClassName =
  "group flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-900/5"

function TarjetaEnlace({ enlace }: { enlace: (typeof ENLACES)[number] }) {
  const contenido = (
    <>
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-xl",
          enlace.acento
        )}
      >
        <enlace.icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-bold text-zinc-900">{enlace.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-zinc-600">
        {enlace.description}
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700">
        {enlace.cta}
        <ArrowRight
          className="size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </>
  )

  if (enlace.external) {
    return (
      <a
        href={enlace.href}
        target="_blank"
        rel="noopener noreferrer"
        className={tarjetaEnlaceClassName}
      >
        {contenido}
      </a>
    )
  }

  return (
    <Link href={enlace.href} className={tarjetaEnlaceClassName}>
      {contenido}
    </Link>
  )
}

function EnlacesSection() {
  return (
    <section id="enlaces" className="scroll-mt-20 border-t border-zinc-100">
      <Container className="py-16 sm:py-20">
        <SectionHeading
          icon={GitBranch}
          eyebrow="Recursos"
          title="Todo el proyecto, abierto para revisar"
          description="El código y la documentación son públicos: puedes verificar cada afirmación de esta página directamente en el repositorio del proyecto."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {ENLACES.map((enlace) => (
            <TarjetaEnlace key={enlace.title} enlace={enlace} />
          ))}
        </div>
      </Container>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 6 · Llamada final y pie de página                                   */
/* ------------------------------------------------------------------ */

function CtaFinalSection() {
  return (
    <section className="bg-linear-to-br from-teal-600 to-cyan-600">
      <Container className="flex flex-col items-center gap-5 py-14 text-center sm:py-16">
        <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          ¿Quieres ver Medisys funcionando con datos reales?
        </h2>
        <p className="max-w-xl text-base leading-7 text-teal-50">
          Explora la clínica de demostración o escríbenos para revisar juntos el
          proceso de desarrollo, la arquitectura y la ruta de implementación.
        </p>
        <div className="mt-1 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href={RESERVAR_DEMO_ROUTE}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-semibold text-teal-700 shadow-lg shadow-teal-900/20 transition hover:bg-teal-50"
          >
            Abrir la clínica demo
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/40 px-6 text-base font-semibold text-white transition hover:bg-white/10"
          >
            <Send className="size-4" aria-hidden="true" />
            Hablar por WhatsApp
          </a>
        </div>
      </Container>
    </section>
  )
}

const enlaceFooterClassName = "text-sm text-zinc-400 transition-colors hover:text-white"

function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-zinc-950 text-zinc-400">
      <Container className="py-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <Brand inverted />
            <p className="mt-4 text-sm leading-6">
              Documentación del proceso de desarrollo y la arquitectura del SaaS
              de agenda médica construido por {COMPANY_NAME}.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Documentación
              </h3>
              <ul className="mt-4 space-y-2.5">
                {NAV_ANCHORS.map((anchor) => (
                  <li key={anchor.href}>
                    <a href={anchor.href} className={enlaceFooterClassName}>
                      {anchor.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Producto
              </h3>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <Link href="/" className={enlaceFooterClassName}>
                    Página principal
                  </Link>
                </li>
                <li>
                  <Link
                    href={RESERVAR_DEMO_ROUTE}
                    className={enlaceFooterClassName}
                  >
                    Clínica de demostración
                  </Link>
                </li>
                <li>
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={enlaceFooterClassName}
                  >
                    Repositorio en GitHub
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Contacto
              </h3>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={enlaceFooterClassName}
                  >
                    WhatsApp de ventas
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${SALES_EMAIL}`}
                    className={enlaceFooterClassName}
                  >
                    {SALES_EMAIL}
                  </a>
                </li>
                <li>
                  <a
                    href={COMPANY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={enlaceFooterClassName}
                  >
                    {COMPANY_URL.replace("https://", "")}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {COMPANY_NAME} · Medisys ·{" "}
            {URL_SITIO_PUBLICO.replace("https://", "")}
          </p>
          <p>Hecho en Venezuela · Next.js 16 + Supabase</p>
        </div>
      </Container>
    </footer>
  )
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function ProcesoSaasPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <TopBar />
      <main className="flex-1">
        <HeroSection />
        <VisionSection />
        <ArchSection />
        <FiscalSection />
        <SecuritySection />
        <EnlacesSection />
        <CtaFinalSection />
      </main>
      <SiteFooter />
    </div>
  )
}
