import Link from "next/link"
import type { ReactNode } from "react"
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bell,
  Building2,
  CalendarCheck,
  CalendarClock,
  Check,
  LayoutDashboard,
  MessageCircle,
  Rocket,
  ShieldCheck,
  Smartphone,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Navbar } from "@/components/landing/Navbar"
import { Brand } from "@/components/landing/Brand"
import {
  RESERVAR_DEMO_ROUTE,
  RESERVAR_INDEPENDIENTE_ROUTE,
} from "@/lib/demo"
import { DemoHubTrigger } from "@/components/demo/DemoHubTrigger"
import { GuiasSection } from "@/components/landing/GuiasSection"
import { listarGuiasPublicas } from "@/lib/guias-publicas"

/*
 * La landing "/" hereda el `metadata` global definido en `src/app/layout.tsx`
 * (SEO + Open Graph + Twitter Cards), garantizando una sola fuente de verdad.
 */

/**
 * ISR: el bloque de guías se refresca cada 5 minutos sin volver dinámica la
 * landing (la lectura de guías usa el cliente service_role, sin cookies).
 */
export const revalidate = 300

/* ------------------------------------------------------------------ */
/* Datos comerciales (placeholders centralizados)                      */
/* ------------------------------------------------------------------ */

/**
 * Número oficial de ventas/contacto en formato internacional:
 * código de país + número, sin "+", espacios ni guiones. WhatsApp +58 424-2810101 → "584228101010".
 */
const WHATSAPP_NUMBER = "584228101010"

const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hola Medisys 👋, vi la landing y quiero activar la plataforma en mi consultorio o clínica."
)}`

/** CTA principal de conversión: iniciar la prueba gratuita de 7 días. */
const WHATSAPP_TRIAL_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hola Medisys 👋, quiero comenzar la prueba gratuita de 7 días para mi consultorio o clínica."
)}`

/** CTA unificado de la tabla de precios (freemium: pagas al llegar a 30). */
const CTA_PLANES = "Comenzar gratis · Pagas al llegar a 30 reservas"

/** CTA del Plan Gratuito (freemium): hasta 30 citas al mes, sin compromiso. */
const WHATSAPP_FREE_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hola Medisys 👋, quiero comenzar gratis con el Plan Gratuito (hasta 30 reservas al mes; pago al llegar a 30 reservas)."
)}`

/** CTA del módulo de Facturación Integrada (acceso anticipado). */
const WHATSAPP_FACTURACION_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hola Medisys 👋, quiero acceso anticipado al módulo de Facturación Integrada (Agenda + Expedientes + Facturación)."
)}`

/**
 * Ruta de la demo de reservas (centralizada en `src/lib/demo.ts`):
 * cambiar el slug solo en `DEMO_CLINIC_SLUG` / `RESERVAR_DEMO_ROUTE`.
 */
const DEMO_ROUTE = RESERVAR_DEMO_ROUTE

/** Empresa desarrolladora (footer). */
const COMPANY_NAME = "Vortex Logic Microsystems"
const COMPANY_URL = "https://vortex.com.ve"
const SALES_EMAIL = "ventas@vortex.com.ve"

/* Datos legales del dominio y su titular (footer). */
const LEGAL_ENTITY = "Centro Iberoamericano de Artes Digitales - IBEARTS, C.A."
const LEGAL_RIF = "J-40724077-3"
const LEGAL_NOTICE = `vortex.com.ve pertenece a ${LEGAL_ENTITY} RIF: ${LEGAL_RIF}`

/* ------------------------------------------------------------------ */
/* Tipos y datos de las secciones                                      */
/* ------------------------------------------------------------------ */

type Benefit = {
  icon: LucideIcon
  chip: string
  title: string
  description: string
  /** Clases del contenedor del ícono (acento por tarjeta). */
  iconClassName: string
}

const BENEFITS: readonly Benefit[] = [
  {
    icon: Smartphone,
    chip: "PWA",
    title: "Tus pacientes reservan sin descargar nada",
    description:
      "Comparte un enlace y el paciente agenda desde el navegador de su teléfono como si fuera una app: elige especialista, día, hora y paga en el mismo flujo.",
    iconClassName: "bg-teal-500/10 text-teal-600 ring-teal-500/15",
  },
  {
    icon: ShieldCheck,
    chip: "Comprobante + referencia",
    title: "Cada Pago Móvil queda validado",
    description:
      "El paciente transfiere, sube el comprobante y escribe la referencia. La recepción los compara contra sus movimientos antes de confirmar la cita.",
    iconClassName: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/15",
  },
  {
    icon: LayoutDashboard,
    chip: "Tiempo real",
    title: "Recepción con el día bajo control",
    description:
      "Reservas, pagos y comprobantes aparecen al instante en el panel de administración con estados claros: en revisión, confirmada o rechazada.",
    iconClassName: "bg-sky-500/10 text-sky-600 ring-sky-500/15",
  },
  {
    icon: CalendarClock,
    chip: "Antichoque",
    title: "Agenda inteligente sin cruces de horarios",
    description:
      "El sistema aparta cada cupo en el momento de la reserva y lo libera si el pago no se completa. Dos citas nunca ocupan la misma hora.",
    iconClassName: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/15",
  },
]

type StepItem = { icon: LucideIcon; title: string; description: string }

const STEPS: readonly StepItem[] = [
  {
    icon: CalendarCheck,
    title: "El paciente reserva solo",
    description:
      "Entra al enlace de tu clínica, elige el especialista y el primer horario libre.",
  },
  {
    icon: Banknote,
    title: "Paga con Pago Móvil",
    description:
      "Selecciona la cuenta del consultorio, transfiere y adjunta el comprobante con su referencia.",
  },
  {
    icon: BadgeCheck,
    title: "Recepción valida y confirma",
    description:
      "El panel muestra el pago al instante; la recepción lo valida y el paciente recibe su cita confirmada.",
  },
]

type PlanLanding = {
  id: string
  badge: string
  nombre: string
  descripcion: string
  precio: string
  precioDetalle: string
  /** Precio anual equivalente (planes de pago). */
  anual?: string
  /** Resumen de perfiles/sedes incluidos en el plan. */
  perfiles: string
  destacado?: boolean
  features: readonly string[]
  demoHref: string
}

const PLANES_LANDING: readonly PlanLanding[] = [
  {
    id: "free",
    badge: "PLAN GRATUITO",
    nombre: "Plan Gratuito",
    descripcion:
      "Para empezar hoy mismo sin costo: ideal para probar la agenda en línea con tus primeros pacientes.",
    precio: "$0",
    precioDetalle: "USD / mes",
    perfiles: "Hasta 30 reservas al mes",
    features: [
      "Hasta 30 reservas al mes",
      "1 Médico",
      "Agendamiento público en 3 pasos",
      "Expediente básico del paciente",
      "Cálculo automático de cobros en USD y VES a la tasa oficial del BCV del día",
      "Sin compromiso",
      "Soporte por WhatsApp",
    ],
    demoHref: RESERVAR_INDEPENDIENTE_ROUTE,
  },
  {
    id: "individual",
    badge: "PLAN INDIVIDUAL",
    nombre: "Plan Individual",
    descripcion:
      "Para médicos independientes que manejan su propio consultorio y agenda personal.",
    precio: "$20",
    precioDetalle: "USD / mes",
    anual: "$200/año",
    perfiles: "1 Médico · Reservas y sedes ilimitadas",
    features: [
      "1 Médico activo",
      "Reservas ilimitadas",
      "Sedes ilimitadas",
      "Agendamiento automatizado en 3 pasos",
      "Expedientes e historial de pacientes",
      "Cálculo automático de cobros en USD y VES a la tasa oficial del BCV del día",
      "Estadísticas e ingresos unificados en USD y Bolívares",
      "Pago Móvil y Zelle habilitados en tu panel (personalizable a cualquier método de cobro que necesites)",
      "Soporte por WhatsApp",
      "🌱 Plataforma en constante evolución: diseñamos e implementamos las nuevas funciones que tu consultorio necesite.",
    ],
    demoHref: RESERVAR_INDEPENDIENTE_ROUTE,
  },
  {
    id: "pyme",
    badge: "PLAN PYME",
    nombre: "Plan PyME",
    descripcion:
      "Para consultorios y centros médicos con varios especialistas en una sola sede.",
    precio: "$50",
    precioDetalle: "USD / mes",
    anual: "$500/año",
    perfiles: "2 a 10 Médicos · 1 Sede",
    destacado: true,
    features: [
      "2 a 10 médicos activos",
      "1 sede",
      "Reservas ilimitadas",
      "Recepción, administración y gestión multi-doctor",
      "Flujo completo de agendamiento público en 4 pasos",
      "Personalización completa con la marca de la clínica",
      "Cálculo automático de cobros en USD y VES a la tasa oficial del BCV del día",
      "Reportes y estadísticas financieras multi-doctor en USD y Bolívares",
      "Pago Móvil y Zelle habilitados en tu panel (personalizable a cualquier método de cobro que necesites)",
      "Soporte prioritario por WhatsApp y correo",
      "7 días de prueba gratis sin compromiso",
    ],
    demoHref: DEMO_ROUTE,
  },
  {
    id: "pro",
    badge: "PLAN PRO",
    nombre: "Plan PRO",
    descripcion:
      "Para clínicas grandes, redes y grupos médicos con múltiples sedes.",
    precio: "$95",
    precioDetalle: "USD / mes",
    anual: "$950/año",
    perfiles: "10+ Médicos o Múltiples Sedes",
    features: [
      "10+ médicos activos",
      "Múltiples sedes",
      "Reservas ilimitadas",
      "Todo lo incluido en el plan PyME",
      "Panel consolidado multi-sede",
      "Migración y configuración inicial sin costo",
      "Cálculo automático de cobros en USD y VES a la tasa oficial del BCV del día",
      "Soporte prioritario dedicado",
      "7 días de prueba gratis sin compromiso",
      "💡 Desarrollo continuo a tu medida: abiertos a escuchar e integrar nuevos módulos o mejoras para el flujo de tu clínica.",
    ],
    demoHref: DEMO_ROUTE,
  },
]

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

/* ================================================================== */
/* Hero                                                                */
/* ================================================================== */

function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Fondos decorativos */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_-2%,rgba(20,184,166,0.12),transparent_70%)]" />
        <div className="absolute -top-32 right-[-10%] size-[30rem] rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute bottom-[-12rem] left-[-8rem] size-[26rem] rounded-full bg-teal-300/20 blur-3xl" />
      </div>

      <Container className="grid items-center gap-14 py-14 sm:py-20 lg:grid-cols-12 lg:gap-10 lg:py-24">
        <div className="max-w-2xl lg:col-span-6">
          {/* Announcement badge: nuevo módulo de Facturación Integrada */}
          <a
            href="#facturacion"
            className="mb-4 inline-flex flex-wrap items-center gap-2 rounded-full border border-teal-200/80 bg-teal-50/80 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-teal-900 shadow-sm backdrop-blur transition-colors hover:border-teal-300 hover:bg-teal-50 sm:text-xs dark:border-teal-500/40 dark:bg-teal-950/30 dark:text-teal-100"
          >
            <Zap
              className="size-3.5 shrink-0 text-amber-500"
              aria-hidden="true"
            />
            Próximamente: Módulo de Facturación Integrada · Tras la nueva
            normativa del SENIAT
          </a>

          <div>
            <a
              href="#precios"
              className="group inline-flex items-center gap-2.5 rounded-full border border-teal-200 bg-teal-50/80 py-1 pl-3 pr-3.5 text-sm font-medium text-teal-700 transition-colors hover:border-teal-300 hover:bg-teal-50"
            >
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Plan Gratuito: hasta 30 citas/mes
              <ArrowRight
                className="size-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </a>
          </div>

          <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-zinc-900 sm:text-5xl xl:text-[3.4rem]">
            Automatiza las citas de tu clínica y verifica cada{" "}
            <span className="whitespace-nowrap">
              <span className="bg-linear-to-r from-teal-600 via-cyan-600 to-sky-600 bg-clip-text text-transparent">
                Pago Móvil
              </span>
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-zinc-600">
            Configura tu clínica en minutos y empieza a recibir reservas hoy
            mismo. Tus pacientes agendan desde el celular y pagan con Pago
            Móvil; la recepción valida cada comprobante en tiempo real.{" "}
            <strong className="font-semibold text-zinc-800">
              Empieza con el Plan Gratuito (hasta 30 citas al mes), sin
              compromiso ni pagos por adelantado.
            </strong>
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <a
              href={WHATSAPP_TRIAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-teal-600 to-cyan-600 px-6 text-base font-semibold text-white shadow-lg shadow-teal-600/25 transition hover:shadow-xl hover:brightness-110 active:scale-[0.99]"
            >
              Prueba 7 Días Gratis
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
            <Link
              href={DEMO_ROUTE}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 text-base font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <CalendarCheck
                className="size-4 text-teal-600"
                aria-hidden="true"
              />
              Ver la demo en vivo
            </Link>
          </div>

          {/* Acceso central a los entornos DEMO */}
          <div className="mt-3">
            <DemoHubTrigger
              label="Explorar Todos los Portales DEMO"
              className="border border-zinc-200 bg-white/90 text-zinc-800 shadow-sm hover:bg-white"
            />
          </div>

          <p className="mt-4 text-sm text-zinc-500">
            Plan Gratuito de hasta 30 citas/mes · Sin compromiso · Configúralo
            en minutos.
          </p>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-zinc-700">
            {[
              "Plan Gratuito: hasta 30 citas/mes",
              "Sin compromiso",
              "Agenda + Expedientes + Facturación",
              "Pago Móvil + Zelle",
            ].map(
              (item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/10">
                    <Check className="size-3 text-emerald-600" aria-hidden="true" />
                  </span>
                  {item}
                </li>
              )
            )}
          </ul>
        </div>

        <div className="lg:col-span-6">
          <HeroVisual />
        </div>
      </Container>
    </section>
  )
}

/** Mockup estático de lo que el cliente ve: reserva + pago por validar. */
function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-lg pb-14 lg:max-w-none lg:pb-10">
      {/* Tarjeta principal: reserva hecha desde el celular */}
      <div className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-xl shadow-teal-900/10 sm:p-6">
        <div
          className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-teal-500 via-cyan-500 to-sky-500"
          aria-hidden="true"
        />

        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-teal-500 to-cyan-600 text-white shadow-sm">
              <Building2 className="size-5" aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-bold text-zinc-900">
                Clínica DEMO
              </span>
              <span className="text-xs text-zinc-500">
                Reserva #2841 · vista del paciente
              </span>
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <BadgeCheck className="size-3.5" aria-hidden="true" />
            Demo activa
          </span>
        </div>

        <dl className="mt-5 space-y-3">
          {[
            { label: "Paciente", value: "María González" },
            { label: "Especialista", value: "Dra. Laura Rincón · Pediatría" },
            { label: "Cita", value: "Hoy · 10:30 am" },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-4 border-t border-dashed border-zinc-100 pt-3"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                {row.label}
              </dt>
              <dd className="text-right text-sm font-semibold text-zinc-800">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <Banknote className="size-4 text-teal-600" aria-hidden="true" />
              Pago Móvil · Banesco
            </span>
            <span className="text-sm font-bold text-zinc-900">$15,00</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="font-mono text-xs text-zinc-500">
              Ref. 01488422
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              <Check className="size-3" aria-hidden="true" />
              Comprobante recibido
            </span>
          </div>
        </div>
      </div>

      {/* Toast: aviso a recepción */}
      <div className="absolute -bottom-1 -left-2 w-64 rounded-2xl border border-zinc-200/80 bg-white/95 p-4 shadow-xl shadow-zinc-900/10 backdrop-blur sm:-left-6 lg:-left-8">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600">
            <Bell className="size-4" aria-hidden="true" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-zinc-900">
              Nuevo pago por validar
            </span>
            <span className="text-xs text-zinc-500">
              Dra. Rincón · Ref. 01488422
            </span>
            <span className="text-[11px] font-medium text-zinc-400">
              hace 1 min · panel de recepción
            </span>
          </span>
        </div>
      </div>

      {/* Chip: cupo apartado */}
      <div className="absolute -top-4 right-2 inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-lg shadow-zinc-900/5 sm:-right-3">
        <CalendarClock className="size-3.5 text-teal-600" aria-hidden="true" />
        Cupo apartado 15 min
      </div>
    </div>
  )
}

/* ================================================================== */
/* Encabezados de sección y sección "Cómo funciona"                    */
/* ================================================================== */

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow: string
  title: string
  description?: string
  align?: "center" | "left"
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center"
      )}
    >
      <span className="inline-flex items-center rounded-full bg-teal-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-700">
        {eyebrow}
      </span>
      <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-pretty text-lg leading-7 text-zinc-600">
          {description}
        </p>
      )}
    </div>
  )
}

/* ================================================================== */
/* Sección Facturación Integrada (próximamente)                        */
/* ================================================================== */

const PUNTOS_FACTURACION = [
  {
    emoji: "🧾",
    titulo: "Facturación sin trabas",
    texto:
      "Emisión directa adaptada a las normativas tributarias vigentes sin intermediarios complejos.",
  },
  {
    emoji: "🔗",
    titulo: "Sincronización Total",
    texto:
      "Factura generada automáticamente al confirmar la reserva de la cita médica.",
  },
  {
    emoji: "🇻🇪",
    titulo: "Cumplimiento Tributario",
    texto:
      "Cálculos exactos en Bolívares y USD con integración a la tasa oficial BCV.",
  },
] as const

function FacturacionSection() {
  return (
    <section id="facturacion" className="scroll-mt-20">
      <Container className="py-12 sm:py-16">
        <div className="relative overflow-hidden rounded-3xl border border-teal-500/30 bg-zinc-950 px-6 py-10 shadow-2xl sm:px-10 sm:py-14">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(65%_60%_at_12%_0%,rgba(20,184,166,0.30),transparent_65%)]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -right-24 -top-24 size-[26rem] rounded-full bg-cyan-500/20 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-300">
                <Rocket className="size-3.5" aria-hidden="true" />
                Próximamente · En desarrollo
              </span>
              <h2 className="max-w-3xl text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
                El nuevo pilar de Medisys: Agenda + Facturación Integrada
              </h2>
              <p className="max-w-3xl text-base leading-7 text-zinc-300">
                Aprovecha la derogación de la homologación de sistemas del
                SENIAT. Estamos construyendo el módulo de facturación médica sin
                complicaciones para que emitas tus comprobantes fiscales y
                gestiones tus cobros desde la misma plataforma.
              </p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-3">
              {PUNTOS_FACTURACION.map((punto) => (
                <li
                  key={punto.titulo}
                  className="flex h-full flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <span className="text-2xl" aria-hidden="true">
                    {punto.emoji}
                  </span>
                  <h3 className="text-base font-bold text-white">
                    {punto.titulo}
                  </h3>
                  <p className="text-sm leading-6 text-zinc-300">{punto.texto}</p>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-4 rounded-2xl border border-teal-400/25 bg-teal-400/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {["Agenda", "Expedientes", "Facturación"].map((pilar) => (
                    <span
                      key={pilar}
                      className="rounded-full border border-teal-300/40 bg-teal-400/10 px-3 py-1 text-xs font-semibold text-teal-200"
                    >
                      {pilar}
                    </span>
                  ))}
                </div>
                <span className="text-sm font-semibold text-white">
                  El ecosistema completo de tu clínica en una sola plataforma.
                </span>
              </div>
              <a
                href={WHATSAPP_FACTURACION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-teal-500 to-cyan-500 px-5 text-sm font-semibold text-white shadow-lg shadow-teal-900/30 transition hover:brightness-110"
              >
                Quiero acceso anticipado
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}

function StepsSection() {
  return (
    <section id="como-funciona" className="scroll-mt-20 border-t border-zinc-100">
      <Container className="py-16 sm:py-20">
        <SectionHeading
          eyebrow="Cómo funciona"
          title="De la reserva al pago verificado en minutos"
          description="El flujo completo que tu paciente vive desde el celular y que tu recepción aprueba desde el panel."
        />

        <ol className="mt-12 grid gap-6 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative">
              {index < STEPS.length - 1 && (
                <span
                  className="absolute left-[calc(50%+2.75rem)] top-6 hidden h-px w-[calc(100%-5.5rem)] border-t-2 border-dashed border-teal-200 sm:block"
                  aria-hidden="true"
                />
              )}
              <div className="flex h-full flex-col items-center rounded-2xl border border-zinc-200/70 bg-white px-6 py-8 text-center shadow-sm">
                <span className="relative flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-600/20">
                  <step.icon className="size-6" aria-hidden="true" />
                </span>
                <span className="mt-5 inline-flex size-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-500">
                  {index + 1}
                </span>
                <h3 className="mt-2 text-lg font-bold text-zinc-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}

/* ================================================================== */
/* Sección Beneficios                                                  */
/* ================================================================== */

function BenefitsSection() {
  return (
    <section
      id="beneficios"
      className="relative scroll-mt-20 overflow-hidden bg-zinc-50/80"
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_0%,rgba(20,184,166,0.07),transparent_70%)]" />
      </div>

      <Container className="py-16 sm:py-20 lg:py-24">
        <SectionHeading
          eyebrow="Beneficios"
          title="Todo lo que tu recepción necesita para no perder pacientes ni pagos"
          description="Cuatro razones por las que consultorios y clínicas en Venezuela dejan atrás las llamadas, las planillas y las transferencias sin control."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {BENEFITS.map((benefit) => (
            <article
              key={benefit.title}
              className="group flex h-full flex-col rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-teal-200 hover:shadow-xl hover:shadow-teal-900/5"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-transform duration-300 group-hover:scale-110",
                    benefit.iconClassName
                  )}
                >
                  <benefit.icon className="size-6" aria-hidden="true" />
                </span>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {benefit.chip}
                </span>
              </div>

              <h3 className="mt-5 text-lg font-bold leading-snug text-zinc-900">
                {benefit.title}
              </h3>
              <p className="mt-2.5 text-sm leading-6 text-zinc-600">
                {benefit.description}
              </p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  )
}

/* ================================================================== */
/* Sección Precios                                                      */
/* ================================================================== */

function PricingSection() {
  return (
    <section id="precios" className="relative scroll-mt-20 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
      >
        <div className="absolute inset-x-0 bottom-[-14rem] h-96 bg-[radial-gradient(55%_100%_at_50%_100%,rgba(8,145,178,0.1),transparent_70%)]" />
      </div>

      <Container className="py-16 sm:py-20 lg:py-24">
        <SectionHeading
          eyebrow="Precios"
          title="Elige el plan para tu consultorio o clínica"
          description="Empieza gratis y crece cuando lo necesites: Plan Gratuito de hasta 30 citas al mes, Individual para médicos independientes, PyME para consultorios con varios especialistas y PRO para clínicas multi-sede."
        />

        <div className="mx-auto mt-8 flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm">
          <span aria-hidden="true">🎁</span>
          PLAN GRATUITO: HASTA 30 CITAS AL MES · SIN COMPROMISO
        </div>

        <div className="mx-auto mt-10 grid max-w-7xl gap-6 md:grid-cols-2 xl:grid-cols-4">
          {PLANES_LANDING.map((plan) => (
            <article
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-lg",
                plan.destacado ? "border-teal-400 ring-2 ring-teal-500/20" : "border-zinc-200"
              )}
            >
              {plan.destacado && (
                <span className="absolute -top-3 left-6 rounded-full bg-linear-to-r from-teal-600 to-cyan-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                  Más elegido
                </span>
              )}

              <span className="inline-flex w-fit items-center rounded-full bg-teal-600/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-teal-700">
                {plan.badge}
              </span>

              <h3 className="mt-4 text-xl font-bold tracking-tight text-zinc-900">
                {plan.nombre}
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {plan.descripcion}
              </p>

              <div className="mt-5 flex flex-col gap-1">
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-extrabold tracking-tight text-zinc-900">
                    {plan.precio}
                  </span>
                  <span className="pb-1.5 text-xs font-medium leading-4 text-zinc-500">
                    {plan.precioDetalle}
                  </span>
                </div>
                {plan.anual && (
                  <span className="text-xs font-semibold text-teal-700">
                    o {plan.anual} pagando al año
                  </span>
                )}
              </div>

              <p className="mt-3 w-fit rounded-full bg-teal-600/10 px-3 py-1 text-xs font-semibold text-teal-700">
                {plan.perfiles}
              </p>

              <ul className="mt-5 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-zinc-700">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-teal-600/10 text-teal-600">
                      <Check className="size-3" aria-hidden="true" strokeWidth={3} />
                    </span>
                    <span className="leading-5">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex flex-col gap-3">
                <a
                  href={plan.id === "free" ? WHATSAPP_FREE_URL : WHATSAPP_TRIAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-auto min-h-12 items-center justify-center gap-2 whitespace-normal rounded-xl bg-linear-to-r from-teal-600 to-cyan-600 px-5 py-3 text-center text-sm font-semibold leading-snug text-white shadow-lg shadow-teal-600/25 transition hover:shadow-xl hover:brightness-110 active:scale-[0.99]"
                >
                  <span className="whitespace-normal text-balance text-center text-sm font-semibold leading-snug">
                    {CTA_PLANES}
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0"
                    aria-hidden="true"
                  />
                </a>
                <Link
                  href={plan.demoHref}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 text-base font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
                >
                  <CalendarCheck className="size-4 text-teal-600" aria-hidden="true" />
                  Ver demo en vivo
                </Link>
              </div>
            </article>
          ))}
        </div>

        <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-5 text-zinc-500">
          Precios en USD. El cobro de los planes de pago se liquida en Bolívares
          a la tasa oficial del BCV del día. El Plan Gratuito no tiene
          compromiso.
        </p>
      </Container>
    </section>
  )
}
/* ================================================================== */
/* Footer                                                              */
/* ================================================================== */

function FooterColumn({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
        {title}
      </h3>
      <ul className="mt-4 space-y-3 text-sm">{children}</ul>
    </div>
  )
}

const footerLinkClassName =
  "inline-flex text-zinc-400 transition-colors hover:text-white"

function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-zinc-950 text-zinc-400">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.9fr_1fr]">
          {/* Marca */}
          <div>
            <Brand inverted />
            <p className="mt-4 max-w-xs text-sm leading-6">
              Agenda médica inteligente y control de Pago Móvil para
              consultorios y clínicas en Venezuela. Producto de Vortex Logic
              Microsystems.
            </p>
            <a
              href={COMPANY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-400 transition-colors hover:text-teal-300",
                footerLinkClassName
              )}
            >
              vortex.com.ve
            </a>
          </div>

          {/* Producto */}
          <FooterColumn title="Producto">
            <li>
              <Link href={DEMO_ROUTE} className={footerLinkClassName}>
                Demo en vivo
              </Link>
            </li>
            <li>
              <a href="#beneficios" className={footerLinkClassName}>
                Beneficios
              </a>
            </li>
            <li>
              <a href="#como-funciona" className={footerLinkClassName}>
                Cómo funciona
              </a>
            </li>
            <li>
              <a href="#precios" className={footerLinkClassName}>
                Precios
              </a>
            </li>
          </FooterColumn>

          {/* Empresa */}
          <FooterColumn title="Empresa">
            <li>
              <a
                href={COMPANY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={footerLinkClassName}
              >
                Vortex Logic Microsystems
              </a>
            </li>
            <li>
              <a
                href={`mailto:${SALES_EMAIL}`}
                className={footerLinkClassName}
              >
                {SALES_EMAIL}
              </a>
            </li>
          </FooterColumn>

          {/* Contacto */}
          <FooterColumn title="Contacto">
            <li>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-1.5",
                  footerLinkClassName
                )}
              >
                <MessageCircle className="size-4 text-emerald-500" aria-hidden="true" />
                WhatsApp de ventas
              </a>
            </li>
            <li>
              <span className="text-zinc-500">
                Soporte en español para Venezuela
              </span>
            </li>
            <li>
              <span className="text-zinc-500">
                Pago en USD o Bs vía Pago Móvil
              </span>
            </li>
          </FooterColumn>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-zinc-500 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <p>
              © {year} {COMPANY_NAME} · Todos los derechos reservados.
            </p>
            <p className="text-[11px] leading-5 text-zinc-500/90">
              {LEGAL_NOTICE}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a
              href={COMPANY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-zinc-200"
            >
              vortex.com.ve
            </a>
            <Link href={DEMO_ROUTE} className="transition-colors hover:text-zinc-200">
              Clínica DEMO
            </Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-zinc-200"
            >
              Escríbenos
            </a>
          </div>
        </div>
      </Container>
    </footer>
  )
}

/* ================================================================== */
/* Página                                                              */
/* ================================================================== */

export default async function Home() {
  const guias = await listarGuiasPublicas()

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <FacturacionSection />
        <StepsSection />
        <GuiasSection guias={guias} />
        <BenefitsSection />
        <PricingSection />
      </main>
      <SiteFooter />
    </div>
  )
}
