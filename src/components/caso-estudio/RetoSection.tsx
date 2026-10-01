import {
  AlertTriangle,
  Banknote,
  ClipboardList,
  FileWarning,
  ListChecks,
  PhoneOff,
} from "lucide-react"

import { Panel, Section, SectionHeading } from "@/components/caso-estudio/ui"
import { Callout, ListaChecks } from "@/components/caso-estudio/piezas"

/** Los tres dolores que originaron el producto, en palabras del cliente. */
const DOLORES = [
  {
    icon: PhoneOff,
    titulo: "La agenda vive en un cuaderno y en WhatsApp",
    dolor:
      "Dos secretarias, un teléfono y una hoja de cálculo por sede. Los turnos se anotan a lápiz y se tachan cuando el paciente confirma por mensaje.",
    impacto:
      "Cupos duplicados y horas de consultorio vacías: cada cita fantasma es ingreso perdido y un paciente que no vuelve.",
  },
  {
    icon: Banknote,
    titulo: "Cobrar en un país sin pasarelas de pago",
    dolor:
      "Las pasarelas internacionales tardan meses en aprobar una cuenta; en la práctica se cobra con Pago Móvil, Zelle, efectivo y punto de venta, verificando capturas de pantalla enviadas por el paciente.",
    impacto:
      "Precios fijados en dólares y cobros en bolívares a la tasa del día: sin una tasa confiable, la conciliación de caja se vuelve una discusión diaria.",
  },
  {
    icon: FileWarning,
    titulo: "Facturación que la ley exige y el Excel no puede dar",
    dolor:
      "IVA del 16 % con la exención de los servicios médicos, IGTF del 3 % cuando el pago llega en divisas, numeración de formas libres con correlativo y número de control, y desglose en bolívares y dólares.",
    impacto:
      "Emitir una factura inválida o no declarar el IGTF expone a la clínica a sanciones: no es un problema de diseño, es de cumplimiento.",
  },
] as const

/** Restricciones reales del proyecto (no supuestos de laboratorio). */
const RESTRICCIONES = [
  "Equipo unipersonal: cualquier componente que no pueda mantener una sola persona es deuda técnica disfrazada de arquitectura.",
  "Sin servidores propios: el presupuesto inicial no admite clústeres, colas ni contenedores que administrar.",
  "Tráfico impredecible: una campaña en redes satura el agendamiento en minutos y luego vuelve a la calma.",
  "Recepción con internet irregular: el panel debe abrir rápido en laptops viejas y en pantallas pequeñas.",
  "El BCV no publica API: su portal bloquea clientes sin User-Agent de navegador, así que la tasa solo puede obtenerse con scraping tolerante a fallos.",
  "Datos de salud: aislamiento estricto entre clínicas y mínimo privilegio desde el primer commit, no como mejora posterior.",
] as const

export function RetoSection() {
  return (
    <Section id="reto" tone="muted">
      <SectionHeading
        indice="01"
        eyebrow="El reto"
        icon={AlertTriangle}
        title="Un sector que todavía opera con papel, teléfono y Excel"
        description="Medisys no nació como un ejercicio de arquitectura: nació de tres dolores concretos de las clínicas venezolanas. Entenderlos fue lo que definió cada decisión técnica posterior."
      />

      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {DOLORES.map((dolor) => {
          const Icono = dolor.icon
          return (
            <Panel key={dolor.titulo} className="flex flex-col">
              <span className="flex size-10 items-center justify-center rounded-xl bg-zinc-900 text-teal-300">
                <Icono className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-bold text-zinc-900">
                {dolor.titulo}
              </h3>
              <p className="mt-2.5 text-sm leading-6 text-zinc-600">
                {dolor.dolor}
              </p>
              <p className="mt-4 border-t border-zinc-100 pt-4 text-sm leading-6 text-zinc-500">
                <span className="font-semibold text-zinc-700">Impacto: </span>
                {dolor.impacto}
              </p>
            </Panel>
          )
        })}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <Panel>
          <p className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-700">
            <ListChecks className="size-4" aria-hidden="true" />
            Restricciones de diseño
          </p>
          <ListaChecks items={RESTRICCIONES} icon={AlertTriangle} className="mt-5" />
        </Panel>

        <div className="space-y-5">
          <Callout
            icon={ClipboardList}
            titulo="De los dolores a los requisitos"
          >
            <p>
              Los tres problemas se tradujeron en cuatro requisitos no
              negociables que gobiernan todo el sistema:
            </p>
            <ol className="mt-3 space-y-2 text-sm leading-6">
              <li>
                <span className="font-mono text-teal-800">R1</span> Multi-tenant
                con aislamiento verificable en la base de datos, no solo en el
                código de la aplicación.
              </li>
              <li>
                <span className="font-mono text-teal-800">R2</span> Una tasa
                oficial confiable, cacheada y con respaldos en cascada.
              </li>
              <li>
                <span className="font-mono text-teal-800">R3</span> Un motor
                fiscal determinista, auditable y explicable ante el SENIAT.
              </li>
              <li>
                <span className="font-mono text-teal-800">R4</span> Una interfaz
                que una recepcionista use sin manual el primer día.
              </li>
            </ol>
          </Callout>

          <Panel tone="muted">
            <p className="text-sm font-bold text-zinc-900">
              El criterio que apliqué en todo el proyecto
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Cada requisito se resolvió en la capa donde el problema es más
              barato de resolver: el aislamiento entre clínicas vive en Postgres
              (RLS), la concurrencia vive en el modelo de datos (locks con
              expiración), y el cumplimiento fiscal vive en funciones puras sin
              E/S. Ese reparto es, en mi opinión, la diferencia entre un
              prototipo y un producto que factura.
            </p>
          </Panel>
        </div>
      </div>
    </Section>
  )
}
