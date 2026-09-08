import type { Metadata } from "next"
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
  HeartPulse,
  LayoutDashboard,
  MessageCircle,
  ShieldCheck,
  Smartphone,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/* SEO de la landing page (ruta "/")                                   */
/* ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title:
    "Medisys | Agenda médica automática y Pago Móvil verificado para clínicas en Venezuela",
  description:
    "Automatiza las citas de tu consultorio o clínica: tus pacientes reservan desde el celular y pagan con Pago Móvil. Tu recepción valida comprobante y referencia en tiempo real desde un panel.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Medisys | Agenda tu clínica y verifica cada Pago Móvil",
    description:
      "Reservas 24/7 sin descargas y validación de Pago Móvil en tiempo real. Prueba la demo en vivo.",
    locale: "es_VE",
    type: "website",
  },
}

/* ------------------------------------------------------------------ */
/* Datos comerciales (placeholders centralizados)                      */
/* ------------------------------------------------------------------ */

/**
 * ⚠️ PLACEHOLDER COMERCIAL.
 * Reemplazar por el número oficial de ventas en formato internacional:
 * código de país + número, sin "+", espacios ni guiones. Ej.: "584141234567".
 */
const WHATSAPP_NUMBER = "584120000000"

const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hola Medisys 👋, vi la landing y quiero activar la plataforma en mi consultorio o clínica."
)}`

/**
 * Ruta de la demo activa.
 * La clínica de demostración se llama "Clínica DEMO" y su slug en Supabase
 * debe ser `clinica-demo`. Si el tenant todavía existe como `santa-ines`,
 * renómbralo en la base de datos:
 *   UPDATE tenants SET slug = 'clinica-demo', nombre = 'Clínica DEMO'
 *   WHERE slug = 'santa-ines';
 */
const DEMO_ROUTE = "/clinica-demo/reservar"

/** Empresa desarrolladora (footer). */
const COMPANY_NAME = "Vortex Logic Microsystems"
const COMPANY_URL = "https://vortex.com.ve"
const SALES_EMAIL = "ventas@vortex.com.ve"

/* ------------------------------------------------------------------ */
/* Tipos y datos de las secciones                                      */
/* ------------------------------------------------------------------ */

type NavItem = { label: string; href: string }

const NAV_ITEMS: readonly NavItem[] = [
  { label: "Beneficios", href: "#beneficios" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Precios", href: "#precios" },
]

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

const PRICING_FEATURES: readonly string[] = [
  "Especialistas ilimitados",
  "Soporte prioritario por WhatsApp y correo",
  "Hosting en la nube con respaldos automáticos",
  "Personalización con la marca de tu clínica",
  "Pago Móvil y Zelle habilitados en tu panel",
  "Pacientes y reservas ilimitadas",
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

function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-teal-500 to-cyan-600 text-white shadow-md shadow-teal-600/20">
        <HeartPulse className="size-5" aria-hidden="true" strokeWidth={2.2} />
      </span>
      <span
        className={cn(
          "text-lg font-bold tracking-tight",
          inverted ? "text-white" : "text-zinc-900"
        )}
      >
        Medisys
      </span>
    </span>
  )
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="Medisys, inicio" className="shrink-0">
          <Brand />
        </Link>

        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-8 md:flex"
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-950"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Escribir por WhatsApp"
            className="inline-flex size-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
          </a>
          <Link
            href={DEMO_ROUTE}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-zinc-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700"
          >
            Probar demo
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </Container>
    </header>
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
          <Link
            href={DEMO_ROUTE}
            className="group inline-flex items-center gap-2.5 rounded-full border border-teal-200 bg-teal-50/80 py-1 pl-2.5 pr-3.5 text-sm font-medium text-teal-700 transition-colors hover:border-teal-300 hover:bg-teal-50"
          >
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Demo en vivo: Clínica DEMO
            <ArrowRight
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>

          <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-zinc-900 sm:text-5xl xl:text-[3.4rem]">
            Automatiza las citas de tu clínica y verifica cada{" "}
            <span className="whitespace-nowrap">
              <span className="bg-linear-to-r from-teal-600 via-cyan-600 to-sky-600 bg-clip-text text-transparent">
                Pago Móvil
              </span>
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-zinc-600">
            Medisys es la solución SaaS multi-tenant diseñada para optimizar la
            agendación médica y la gestión operativa en clínicas y
            consultorios. Permite a los pacientes autogestionar sus citas desde
            cualquier dispositivo y procesar pagos vía Pago Móvil. Automatiza
            la recepción, concilia referencias en tiempo real y reduce
            drásticamente las llamadas administrativas y la saturación en sala
            de espera.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              href={DEMO_ROUTE}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-teal-600 to-cyan-600 px-6 text-base font-semibold text-white shadow-lg shadow-teal-600/25 transition hover:shadow-xl hover:brightness-110 active:scale-[0.99]"
            >
              Probar la demo en vivo
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 text-base font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <MessageCircle
                className="size-4 text-emerald-600"
                aria-hidden="true"
              />
              Hablar con un asesor
            </a>
          </div>

          <p className="mt-4 text-sm text-zinc-500">
            Demo real del flujo completo: agenda una cita de prueba en 4 pasos,
            sin crear cuenta.
          </p>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-zinc-700">
            {["Sin descargas para el paciente", "Pago Móvil + Zelle", "Soporte en español"].map(
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
          title="Una tarifa plana que se paga sola con la primera cita"
          description="Diseñado para consultorios y clínicas medianas que cobran por consulta: con pocas citas al mes, Medisys se financia solo."
        />

        <div className="relative mx-auto mt-12 max-w-5xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl shadow-teal-900/10">
          <div
            className="h-1.5 w-full bg-linear-to-r from-teal-500 via-cyan-500 to-sky-500"
            aria-hidden="true"
          />

          <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
            {/* Columna del plan y CTAs */}
            <div className="flex flex-col">
              <span className="inline-flex w-fit items-center rounded-full bg-teal-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-700">
                Plan único · por sede
              </span>

              <div className="mt-6 flex items-end gap-3">
                <span className="text-6xl font-extrabold tracking-tight text-zinc-900">
                  $100
                </span>
                <span className="pb-2 text-sm font-medium leading-5 text-zinc-500">
                  USD / mes
                  <br />
                  por sede
                </span>
              </div>

              <p className="mt-5 text-pretty leading-7 text-zinc-600">
                Un solo plan con todo incluido, pensado para clínicas
                medianas y consultorios con varios especialistas que cobran con
                Pago Móvil.
              </p>

              <ul className="mt-6 space-y-3">
                {[
                  "Incluye tu enlace público con la marca de tu clínica",
                  "Configuración y migración de tu agenda sin costo",
                  "Sin permanencia: cancela cuando quieras",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-sm text-zinc-600"
                  >
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                      <Check className="size-3 text-emerald-600" aria-hidden="true" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-col gap-3">
                <Link
                  href={DEMO_ROUTE}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-teal-600 to-cyan-600 px-6 text-base font-semibold text-white shadow-lg shadow-teal-600/25 transition hover:shadow-xl hover:brightness-110 active:scale-[0.99]"
                >
                  Probar la demo en vivo
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 text-base font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
                >
                  <MessageCircle
                    className="size-4 text-emerald-600"
                    aria-hidden="true"
                  />
                  Activar con un asesor
                </a>
              </div>
            </div>

            {/* Columna del checklist */}
            <div className="lg:border-l lg:border-dashed lg:border-zinc-200 lg:pl-14">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                Todo incluido en la suscripción
              </h3>
              <ul className="mt-5 space-y-4">
                {PRICING_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-600/10 text-teal-600">
                      <Check className="size-3.5" aria-hidden="true" strokeWidth={3} />
                    </span>
                    <span className="text-[15px] font-medium leading-6 text-zinc-800">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-teal-100 bg-teal-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-teal-900">
                  ¿Manejas más de una sede?
                  <span className="block text-teal-700/80">
                    Armamos un plan multiclínica con descuento.
                  </span>
                </p>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-teal-200 bg-white px-4 text-sm font-semibold text-teal-700 transition hover:border-teal-300 hover:bg-teal-50"
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                  Cotizar sedes
                </a>
              </div>
            </div>
          </div>
        </div>
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

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {COMPANY_NAME} · Todos los derechos reservados.
          </p>
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

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">
        <HeroSection />
        <StepsSection />
        <BenefitsSection />
        <PricingSection />
      </main>
      <SiteFooter />
    </div>
  )
}
