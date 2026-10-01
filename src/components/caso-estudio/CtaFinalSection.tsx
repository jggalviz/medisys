import Link from "next/link"
import {
  ArrowRight,
  ArrowUpRight,
  Coins,
  Gauge,
  GitBranch,
  Layers,
  Mail,
  MessageCircle,
  ShieldCheck,
} from "lucide-react"

import { Chip, Panel, Section, SectionHeading } from "@/components/caso-estudio/ui"
import {
  DEMO_ROUTE,
  DEMO_URL,
  GITHUB_URL,
  SALES_EMAIL,
  SITIO_URL,
  WHATSAPP_URL,
} from "@/components/caso-estudio/constantes"

/** Lo que un reclutador técnico puede comprobar revisando el repositorio. */
const APORTES = [
  {
    icon: Layers,
    titulo: "Arquitectura sin sobre-ingeniería",
    detalle:
      "Capacidad de elegir el diseño más simple que resuelve el problema —y de documentar qué se descartó y por qué— con un monolito modular tipado y desplegado en un solo lugar.",
  },
  {
    icon: ShieldCheck,
    titulo: "Seguridad y datos",
    detalle:
      "Aislamiento multi-tenant con Row Level Security, RBAC de tres capas y multi-sede: el acceso se decide en el motor de la base de datos, no por convención ni por disciplina.",
  },
  {
    icon: Coins,
    titulo: "Dominios regulados",
    detalle:
      "Traducción de normativa fiscal a funciones puras y auditables (IVA, IGTF, doble moneda, numeración) y de la ausencia de pasarelas locales a flujos de cobro reales.",
  },
  {
    icon: Gauge,
    titulo: "Rendimiento y operación",
    detalle:
      "Server Components para servir menos JavaScript, caché en las fuentes externas, cron con credencial propia y un motor de tasas que degrada con elegancia en lugar de fallar.",
  },
] as const

/** Sección 05 · Llamadas a la acción para reclutadores y equipos técnicos. */
export function CtaFinalSection() {
  return (
    <Section id="contacto" tone="dark">
      <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <SectionHeading
            indice="05"
            eyebrow="Contacto"
            icon={Mail}
            tone="dark"
            title="¿Construimos el próximo producto con este nivel de criterio?"
            description="Estoy disponible para roles full-stack o de backend en equipos de producto, con especial interés en dominios donde la normativa local, los pagos y los datos sensibles son el verdadero problema de ingeniería. El código de Medisys está abierto: revísalo y escríbeme con la pregunta que quieras."
          />

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-teal-400 px-5 py-3 text-sm font-bold text-zinc-950 transition-colors hover:bg-teal-300"
            >
              <GitBranch className="size-4" aria-hidden="true" />
              Ver el código en GitHub
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
            <a
              href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent(
                "Medisys · caso de estudio"
              )}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-teal-400/60 hover:bg-white/5"
            >
              <Mail className="size-4" aria-hidden="true" />
              {SALES_EMAIL}
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-teal-400/60 hover:bg-white/5"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              WhatsApp
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <Chip dark>Respondo personalmente cada mensaje</Chip>
            <Chip dark>Documentación y código en español e inglés</Chip>
          </div>

          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {APORTES.map((aporte) => {
              const Icono = aporte.icon
              return (
                <li
                  key={aporte.titulo}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <p className="flex items-center gap-2 text-sm font-bold text-white">
                    <Icono className="size-4 text-teal-300" aria-hidden="true" />
                    {aporte.titulo}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {aporte.detalle}
                  </p>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="space-y-4">
          <Panel tone="dark">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-300">
              Recorridos sugeridos
            </p>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href={DEMO_ROUTE}
                  className="group flex items-start justify-between gap-3 rounded-xl border border-white/10 px-3.5 py-3 transition-colors hover:border-teal-400/40 hover:bg-white/5"
                >
                  <span>
                    <span className="block text-sm font-semibold text-zinc-100">
                      Reserva una cita en la clínica demo
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] text-zinc-400">
                      {DEMO_URL.replace("https://", "")}
                    </span>
                  </span>
                  <ArrowRight
                    className="mt-1 size-4 shrink-0 text-zinc-500 transition-colors group-hover:text-teal-300"
                    aria-hidden="true"
                  />
                </Link>
              </li>
              <li>
                <a
                  href={SITIO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start justify-between gap-3 rounded-xl border border-white/10 px-3.5 py-3 transition-colors hover:border-teal-400/40 hover:bg-white/5"
                >
                  <span>
                    <span className="block text-sm font-semibold text-zinc-100">
                      Ver la plataforma en producción
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] text-zinc-400">
                      {SITIO_URL.replace("https://", "")}
                    </span>
                  </span>
                  <ArrowUpRight
                    className="mt-1 size-4 shrink-0 text-zinc-500 transition-colors group-hover:text-teal-300"
                    aria-hidden="true"
                  />
                </a>
              </li>
              <li>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start justify-between gap-3 rounded-xl border border-white/10 px-3.5 py-3 transition-colors hover:border-teal-400/40 hover:bg-white/5"
                >
                  <span>
                    <span className="block text-sm font-semibold text-zinc-100">
                      Leer el motor fiscal y el de tasas
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] text-zinc-400">
                      src/lib/billing-ve.ts · src/lib/bcv.ts
                    </span>
                  </span>
                  <ArrowUpRight
                    className="mt-1 size-4 shrink-0 text-zinc-500 transition-colors group-hover:text-teal-300"
                    aria-hidden="true"
                  />
                </a>
              </li>
            </ul>
          </Panel>

          <Panel tone="dark">
            <p className="text-sm font-bold text-white">
              ¿Prefieres empezar por lo difícil?
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              La sección de retos técnicos explica el bloqueo de 15 minutos, el
              cálculo condicional del IGTF y la matriz de permisos. Si vas a
              evaluar el código, ese es el mejor lugar para empezar a leerlo
              críticamente.
            </p>
            <a
              href="#retos-tecnicos"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-300 hover:text-teal-200"
            >
              Ir a los retos técnicos
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </Panel>
        </div>
      </div>
    </Section>
  )
}
