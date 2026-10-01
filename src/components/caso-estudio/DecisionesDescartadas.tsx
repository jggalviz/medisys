import { GitCompareArrows } from "lucide-react"

import { TD_CLASS, TH_CLASS, TablaScroll } from "@/components/caso-estudio/ui"

type Alternativa = {
  opcion: string
  motivo: string
  elegido: string
}

/** Alternativas evaluadas y descartadas, con el motivo técnico de cada una. */
const ALTERNATIVAS: readonly Alternativa[] = [
  {
    opcion: "Microservicios por módulo",
    motivo:
      "Sobrecarga operativa y latencia entre servicios sin un equipo que los opere: el cuello de botella era el producto, no el cómputo.",
    elegido:
      "Monolito modular con módulos puros como frontera. Separar un módulo después es una decisión reversible.",
  },
  {
    opcion: "Una base de datos (o un esquema) por clínica",
    motivo:
      "Multiplicar conexiones y migraciones para cada tenant cuesta más de operar que aislar con políticas declarativas.",
    elegido:
      "Multi-tenant por fila: tenant_id en las tablas + 64 políticas RLS y funciones de pertenencia.",
  },
  {
    opcion: "API REST propia con estado global en el cliente",
    motivo:
      "Cada endpoint duplicaba validación, contratos y manejo de errores, y el cliente acumulaba estado que el servidor ya conocía.",
    elegido:
      "Server Actions tipadas que devuelven ActionResult con códigos accionables; el servidor sigue siendo la única fuente de verdad.",
  },
  {
    opcion: "Calcular impuestos con un modelo de lenguaje",
    motivo:
      "Un impuesto no se estima: se calcula. Hacía falta determinismo, reproducibilidad y poder explicar cada bolívar ante una fiscalización.",
    elegido:
      "Funciones puras con las alícuotas como constantes (IVA 16 %, IGTF 3 %) y redondeo explícito a dos decimales.",
  },
  {
    opcion: "Cron en un servicio externo (terceros o CI)",
    motivo:
      "Otra credencial que rotar, otra cuota que vigilar y otro panel donde buscar el porqué de un fallo.",
    elegido:
      "Vercel Cron apuntando a un Route Handler propio, autenticado con CRON_SECRET y con maxDuration declarado.",
  },
  {
    opcion: "Guardar la tasa en una variable global del proceso",
    motivo:
      "En un entorno serverless no existe memoria compartida confiable entre invocaciones: el valor se perdería sin avisar.",
    elegido:
      "Persistencia en la tabla bcv_rates + caché HTTP de una hora en las consultas a la fuente.",
  },
]

/** Tabla de trade-offs: lo que decidí no construir y por qué. */
export function DecisionesDescartadas() {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-zinc-900 text-teal-300">
          <GitCompareArrows className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-base font-bold text-zinc-900">
            Alternativas que evalué y descarté
          </p>
          <p className="text-sm text-zinc-500">
            Documentar lo que no se construyó es parte del diseño.
          </p>
        </div>
      </div>

      <TablaScroll>
        <table className="min-w-[46rem] border-collapse bg-white">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr>
              <th className={TH_CLASS}>Alternativa considerada</th>
              <th className={TH_CLASS}>Por qué no</th>
              <th className={TH_CLASS}>Qué hice en su lugar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {ALTERNATIVAS.map((alternativa) => (
              <tr key={alternativa.opcion} className="hover:bg-zinc-50/60">
                <td className={`${TD_CLASS} font-semibold text-zinc-900`}>
                  {alternativa.opcion}
                </td>
                <td className={TD_CLASS}>{alternativa.motivo}</td>
                <td className={TD_CLASS}>{alternativa.elegido}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablaScroll>
    </div>
  )
}
