import { Compass } from "lucide-react"

import { Section, SectionHeading } from "@/components/caso-estudio/ui"
import { ArquitecturaDecisiones } from "@/components/caso-estudio/ArquitecturaDecisiones"
import { DiagramaArquitectura } from "@/components/caso-estudio/DiagramaArquitectura"
import { DecisionesDescartadas } from "@/components/caso-estudio/DecisionesDescartadas"

function Subtitulo({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="max-w-3xl">
      <h3 className="text-xl font-bold tracking-tight text-zinc-900">
        {titulo}
      </h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{detalle}</p>
    </div>
  )
}

/** Sección 02 · Decisiones de arquitectura, mapa de capas y descartes. */
export function ArquitecturaSection() {
  return (
    <Section id="arquitectura">
      <SectionHeading
        indice="02"
        eyebrow="La solución arquitectónica"
        icon={Compass}
        title="Tres decisiones que sostienen todo el sistema"
        description="Cada decisión se tomó contra una alternativa concreta y con su costo asumido por escrito. Estas son las tres que gobiernan el producto, el mapa de capas resultante y las opciones que evalué y descarté."
      />

      <div className="mt-12">
        <ArquitecturaDecisiones />
      </div>

      <div className="mt-16">
        <Subtitulo
          titulo="Cómo se conecta todo"
          detalle="Seis capas con una dirección de dependencia explícita. Cada flecha representa una frontera que puedo revisar, probar o reemplazar de forma independiente."
        />
        <div className="mt-6">
          <DiagramaArquitectura />
        </div>
      </div>

      <div className="mt-16">
        <DecisionesDescartadas />
      </div>
    </Section>
  )
}
