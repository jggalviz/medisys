import Link from "next/link"
import {
  ArrowRight,
  ArrowUpRight,
  Braces,
  GitBranch,
  Scale,
  ShieldCheck,
  Timer,
} from "lucide-react"

import { Chip, Container } from "@/components/caso-estudio/ui"
import { KpiGrid } from "@/components/caso-estudio/piezas"
import { FichaTecnicaHero } from "@/components/caso-estudio/FichaTecnicaHero"
import {
  DEMO_ROUTE,
  GITHUB_HANDLE,
  GITHUB_URL,
  METRICAS,
} from "@/components/caso-estudio/constantes"

/** Resumen ejecutivo: lo que el proyecto demuestra como ingeniería. */
const HALLAZGOS = [
  {
    icon: Braces,
    titulo: "Monolito modular, no microservicios",
    detalle:
      "Un despliegue en Vercel con Server Components y Server Actions: menos superficie operativa, mismos límites de dominio.",
  },
  {
    icon: ShieldCheck,
    titulo: "Seguridad en la base de datos",
    detalle:
      "64 políticas RLS aíslan cada clínica y cada rol: un fallo en la interfaz no puede filtrar datos de otro tenant.",
  },
  {
    icon: Timer,
    titulo: "Concurrencia con reloj",
    detalle:
      "Locks de 15 minutos sobre los turnos: el cupo se libera solo si el paciente no completa el pago a tiempo.",
  },
  {
    icon: Scale,
    titulo: "Cumplimiento fiscal automatizado",
    detalle:
      "IVA 16 %, IGTF 3 % solo en divisas, doble despliegue USD/VES y numeración fiscal: cálculo determinista y auditable, sin IA en runtime.",
  },
] as const

export function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden bg-zinc-950 text-zinc-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(20,184,166,0.22),transparent_72%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-teal-400/60 to-transparent"
      />

      <Container className="relative py-20 sm:py-24">
        <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip dark icon={GitBranch}>
                {GITHUB_HANDLE}
              </Chip>
              <Chip dark icon={Timer}>
                1 desarrollador · full-stack
              </Chip>
              <Chip dark icon={ShieldCheck}>
                SaaS multi-tenant en producción
              </Chip>
            </div>

            <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl">
              Cómo diseñé y construí{" "}
              <span className="bg-linear-to-r from-teal-300 via-teal-200 to-emerald-300 bg-clip-text text-transparent">
                Medisys
              </span>
            </h1>

            <p className="mt-4 text-lg font-semibold text-teal-200 sm:text-xl">
              SaaS médico multi-tenant y suite fiscal para Venezuela
            </p>

            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300">
              Una plataforma que digitaliza la operación completa de una clínica
              —agenda, cobros, expedientes, facturación y contabilidad— en un
              mercado donde la tasa oficial cambia a diario, las pasarelas
              internacionales no operan y cada factura debe cumplir con el
              SENIAT. Este es el recorrido técnico del proyecto: las decisiones
              de arquitectura, sus compromisos y los problemas difíciles que
              resolví.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-teal-400 px-5 py-3 text-sm font-bold text-zinc-950 transition-colors hover:bg-teal-300"
              >
                <GitBranch className="size-4" aria-hidden="true" />
                Explorar el código fuente
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
              <Link
                href={DEMO_ROUTE}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-teal-400/60 hover:bg-white/5"
              >
                Probar la clínica demo
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>

            <dl className="mt-10 grid gap-5 border-t border-white/10 pt-6 sm:grid-cols-3">
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                  Rol
                </dt>
                <dd className="mt-1 text-sm text-zinc-300">
                  Arquitectura, backend, frontend y datos
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                  Alcance
                </dt>
                <dd className="mt-1 text-sm text-zinc-300">
                  Producto completo: 3 módulos de gestión, portales y Super Admin
                  · 49 rutas
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                  Restricción
                </dt>
                <dd className="mt-1 text-sm text-zinc-300">
                  Equipo unipersonal · infraestructura serverless
                </dd>
              </div>
            </dl>
          </div>
          <FichaTecnicaHero />
        </div>

        <KpiGrid items={METRICAS} dark className="mt-14" />

        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {HALLAZGOS.map((hallazgo) => {
            const Icono = hallazgo.icon
            return (
              <li
                key={hallazgo.titulo}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <p className="flex items-center gap-2 text-sm font-bold text-white">
                  <Icono className="size-4 text-teal-300" aria-hidden="true" />
                  {hallazgo.titulo}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {hallazgo.detalle}
                </p>
              </li>
            )
          })}
        </ul>
      </Container>
    </section>
  )
}
