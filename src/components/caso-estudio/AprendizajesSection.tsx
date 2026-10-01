import { Compass, GraduationCap, Route } from "lucide-react"

import { Callout } from "@/components/caso-estudio/piezas"
import { Panel, Section, SectionHeading } from "@/components/caso-estudio/ui"

/** Aprendizajes, con el mismo nivel de honestidad que las decisiones. */
const APRENDIZAJES = [
  {
    titulo: "El determinismo es una característica de producto",
    detalle:
      "El camino crítico —cotizar, cobrar, facturar— no consulta ningún modelo de lenguaje: usa constantes, funciones puras y redondeo explícito. Un impuesto no se estima, se calcula. Eso hace el resultado reproducible, explicable ante una fiscalización y trivial de ejecutar. La automatización vive en los bordes (capturar la tasa, disparar el cron, avisar al paciente), donde un fallo se degrada sin corromper un número.",
  },
  {
    titulo: "La frontera correcta ahorra más código que cualquier abstracción",
    detalle:
      "Poner el aislamiento entre clínicas en RLS, y no en cada consulta, eliminó una clase completa de errores: ya no hay filtro que olvidar. La regla que me llevo: si el olvido es posible, el diseño está mal.",
  },
  {
    titulo: "Tolerancia a esquemas parcialmente migrados",
    detalle:
      "El código detecta la ausencia de columnas y reintenta con un payload reducido, así que la aplicación funciona aunque una migración aún no se haya aplicado en el entorno de destino. Permite desplegar aplicación y esquema a ritmos distintos sin congelar el producto.",
  },
  {
    titulo: "Un módulo puro es documentación ejecutable",
    detalle:
      "Los archivos de dominio (fiscal-ve, billing-ve, bcv, rbac) no importan Supabase ni React. Eso permite leer el cumplimiento fiscal de un país en un archivo, revisar el impacto de un cambio de alícuota en un diff pequeño y razonar el cálculo sin levantar el servidor.",
  },
  {
    titulo: "Lo que todavía no está",
    detalle:
      "Digo yo lo que falta antes que un revisor: el aforo por turno está declarado como pendiente en el código (hoy el control es por bloqueo de 15 minutos, no por cupo máximo), los avisos usan enlaces de WhatsApp en lugar de la API oficial de mensajería, y falta una batería de pruebas end-to-end del flujo completo de facturación.",
  },
] as const

/** Rutas de escalabilidad, en el orden en que las atacaría. */
const ESCALABILIDAD = [
  "Cada clínica es una fila, no una base de datos: incorporar un tenant nuevo no agrega operación ni migraciones replicadas.",
  "El aislamiento escala con el motor de Postgres, no con la cantidad de condiciones escritas en la aplicación.",
  "Los planes comerciales limitan especialistas y uso desde una única fuente, así que empaquetar o vender distinto no toca la lógica de agenda.",
  "La normativa vive solo en los módulos de país: soportar otro país es escribir un módulo hermano, no mantener un fork del producto.",
  "Siguiente tramo técnico: cola de trabajos con reintentos para el cron, particionado de la tabla de auditoría, registro de la fuente de tasa usada en cada cobro y pruebas de contrato sobre los cálculos fiscales.",
] as const

/** Sección 04 · Aprendizajes, límites declarados y escalabilidad. */
export function AprendizajesSection() {
  return (
    <Section id="aprendizajes">
      <SectionHeading
        indice="04"
        eyebrow="Aprendizajes y escalabilidad"
        icon={GraduationCap}
        title="Lo que aprendí y por qué este sistema aguanta crecer"
        description="Construir un producto regulado con una sola persona obliga a elegir dónde vive cada responsabilidad. Estas son las conclusiones que aplicaría al siguiente proyecto, sin maquillar lo que aún queda pendiente."
      />

      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        {APRENDIZAJES.map((aprendizaje, indice) => (
          <Panel
            key={aprendizaje.titulo}
            tone={indice === APRENDIZAJES.length - 1 ? "muted" : "light"}
            className={indice === APRENDIZAJES.length - 1 ? "lg:col-span-2 lg:order-last" : ""}
          >
            <p className="flex items-start gap-2 text-sm font-bold text-zinc-900">
              <Compass
                className="mt-0.5 size-4 shrink-0 text-teal-700"
                aria-hidden="true"
              />
              {aprendizaje.titulo}
            </p>
            <p className="mt-2.5 text-sm leading-6 text-zinc-600">
              {aprendizaje.detalle}
            </p>
          </Panel>
        ))}
      </div>

      <div className="mt-6">
        <Panel tone="dark" className="p-6 sm:p-8">
          <p className="flex items-center gap-2 text-sm font-bold text-white">
            <Route className="size-4 text-teal-300" aria-hidden="true" />
            Cómo escala este diseño
          </p>
          <ul className="mt-5 space-y-3">
            {ESCALABILIDAD.map((punto) => (
              <li key={punto} className="flex gap-2.5 text-sm leading-6 text-zinc-300">
                <span
                  aria-hidden="true"
                  className="mt-2.5 size-1.5 shrink-0 rounded-full bg-teal-400"
                />
                {punto}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Callout
        icon={Compass}
        titulo="Si volviera a empezar mañana"
        className="mt-6"
      >
        <p className="text-sm leading-6">
          Mantendría el monolito modular y la seguridad en la base de datos,
          adelantaría las pruebas de los cálculos fiscales al primer sprint —no
          son código aburrido, son el corazón del producto— y diseñaría el aforo
          por turno desde el modelo de datos, en lugar de dejarlo como una tarea
          pendiente bien documentada. El resto del recorrido lo volvería a hacer
          igual: pocas piezas, cada una en la capa donde el problema es más
          barato de resolver.
        </p>
      </Callout>
    </Section>
  )
}
