import type { Metadata } from "next"

import { HeroSection } from "@/components/caso-estudio/HeroSection"
import { RetoSection } from "@/components/caso-estudio/RetoSection"
import { ArquitecturaSection } from "@/components/caso-estudio/ArquitecturaSection"
import { RetosTecnicosSection } from "@/components/caso-estudio/RetosTecnicosSection"
import { AprendizajesSection } from "@/components/caso-estudio/AprendizajesSection"
import { CtaFinalSection } from "@/components/caso-estudio/CtaFinalSection"
import { TopBar } from "@/components/caso-estudio/TopBar"
import { SiteFooter } from "@/components/caso-estudio/SiteFooter"
import {
  CASO_ESTUDIO_URL,
  COMPANY_NAME,
  COMPANY_URL,
  GITHUB_HANDLE,
  GITHUB_URL,
  SITIO_URL,
} from "@/components/caso-estudio/constantes"

/*
 * Caso de estudio público de Medisys (`medisys.com.ve/proceso-saas`).
 *
 * Todas las secciones son Server Components: la página se prerenderiza completa
 * (sin estado, sin efectos y sin lectura de datos en tiempo de petición), por lo
 * que se sirve desde el borde como HTML estático. Ese es el mismo criterio de
 * rendimiento que defiende el producto que se documenta aquí.
 */

const TITULO = "Cómo diseñé y construí Medisys · Caso de estudio de ingeniería"

const DESCRIPCION =
  "Caso de estudio técnico de Medisys, SaaS médico multi-tenant y suite fiscal para Venezuela: arquitectura Next.js 16, aislamiento con Row Level Security en Supabase, bloqueos de 15 minutos en los turnos y facturación SENIAT con IVA e IGTF a tasa BCV."

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  keywords: [
    "caso de estudio",
    "arquitectura de software",
    "Next.js 16 App Router",
    "Supabase Row Level Security",
    "SaaS multi-tenant",
    "facturación SENIAT",
    "IGTF Venezuela",
    "tasa BCV",
    "portafolio desarrollador full stack",
  ],
  alternates: { canonical: "/proceso-saas" },
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    url: CASO_ESTUDIO_URL,
    siteName: "Medisys · Caso de estudio",
    locale: "es_VE",
    type: "article",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Medisys · caso de estudio de arquitectura y producto",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRIPCION,
    images: ["/og-image.png"],
  },
}

/** Datos estructurados: el proyecto, quién lo construyó y dónde se publica. */
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Medisys",
  applicationCategory: "HealthApplication",
  operatingSystem: "Web",
  description: DESCRIPCION,
  url: SITIO_URL,
  author: {
    "@type": "Person",
    name: GITHUB_HANDLE,
    url: GITHUB_URL,
  },
  publisher: {
    "@type": "Organization",
    name: COMPANY_NAME,
    url: COMPANY_URL,
  },
  isPartOf: {
    "@type": "WebPage",
    name: TITULO,
    url: CASO_ESTUDIO_URL,
  },
}

export default function ProcesoSaasPage() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      <TopBar />

      <main className="flex-1">
        <HeroSection />
        <RetoSection />
        <ArquitecturaSection />
        <RetosTecnicosSection />
        <AprendizajesSection />
        <CtaFinalSection />
      </main>

      <SiteFooter />
    </div>
  )
}
