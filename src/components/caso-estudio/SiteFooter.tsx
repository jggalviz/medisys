import Link from "next/link"
import { ArrowUpRight, GitBranch, Mail, MessageCircle } from "lucide-react"

import { Brand } from "@/components/landing/Brand"
import { Container } from "@/components/caso-estudio/ui"
import {
  CASO_ESTUDIO_URL,
  COMPANY_NAME,
  COMPANY_URL,
  DEMO_ROUTE,
  GITHUB_URL,
  SALES_EMAIL,
  WHATSAPP_URL,
} from "@/components/caso-estudio/constantes"

const ENLACES = [
  { label: "El reto", href: "#reto", externo: false },
  { label: "Arquitectura", href: "#arquitectura", externo: false },
  { label: "Retos técnicos", href: "#retos-tecnicos", externo: false },
  { label: "Aprendizajes", href: "#aprendizajes", externo: false },
  { label: "Contacto", href: "#contacto", externo: false },
] as const

/** Pie del caso de estudio: identidad, navegación y procedencia del dato. */
export function SiteFooter() {
  const anio = new Date().getFullYear()

  return (
    <footer className="border-t border-white/10 bg-zinc-950 py-14 text-zinc-400">
      <Container>
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <Brand inverted />
            <p className="mt-4 text-sm leading-6">
              SaaS médico multi-tenant y suite fiscal para clínicas venezolanas:
              agenda con bloqueos temporales, cobros en bolívares y divisas,
              facturación con IVA e IGTF y contabilidad por sede.
            </p>
          </div>

          <nav
            aria-label="Secciones del caso de estudio"
            className="grid gap-y-2 text-sm sm:grid-cols-2 sm:gap-x-12"
          >
            {ENLACES.map((enlace) => (
              <a
                key={enlace.href}
                href={enlace.href}
                className="transition-colors hover:text-teal-300"
              >
                {enlace.label}
              </a>
            ))}
          </nav>

          <ul className="space-y-3 text-sm">
            <li>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 transition-colors hover:text-teal-300"
              >
                <GitBranch className="size-4" aria-hidden="true" />
                github.com/jggalviz/medisys
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </a>
            </li>
            <li>
              <Link
                href={DEMO_ROUTE}
                className="inline-flex items-center gap-2 transition-colors hover:text-teal-300"
              >
                <ArrowUpRight className="size-4" aria-hidden="true" />
                Clínica demo de reserva
              </Link>
            </li>
            <li>
              <a
                href={`mailto:${SALES_EMAIL}`}
                className="inline-flex items-center gap-2 transition-colors hover:text-teal-300"
              >
                <Mail className="size-4" aria-hidden="true" />
                {SALES_EMAIL}
              </a>
            </li>
            <li>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 transition-colors hover:text-teal-300"
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                WhatsApp directo
              </a>
            </li>
          </ul>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {anio} {COMPANY_NAME}. Medisys es un producto de {COMPANY_NAME} ·{" "}
            <a
              href={COMPANY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-teal-300"
            >
              {COMPANY_URL.replace("https://", "")}
            </a>
          </p>
          <p className="font-mono">
            Caso de estudio publicado en{" "}
            <a
              href={CASO_ESTUDIO_URL}
              className="underline decoration-dotted underline-offset-2 hover:text-teal-300"
            >
              {CASO_ESTUDIO_URL.replace("https://", "")}
            </a>
          </p>
        </div>
      </Container>
    </footer>
  )
}
