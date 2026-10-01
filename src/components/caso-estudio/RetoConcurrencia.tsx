import {
  AlertTriangle,
  Ban,
  Hourglass,
  Lock,
  RefreshCw,
  Timer,
  Wallet,
} from "lucide-react"

import { Callout, CodePanel, FlujoPasos, type Paso } from "@/components/caso-estudio/piezas"
import { Panel } from "@/components/caso-estudio/ui"

/** Ciclo de vida del bloqueo temporal de un turno. */
const FLUJO: readonly Paso[] = [
  {
    icon: Lock,
    titulo: "El turno se bloquea, no se vende",
    detalle:
      "Al elegir el turno, el servidor crea la cita en estado 'pendiente' con lock_expira_en = ahora + 15 minutos. El cupo queda reservado para ese paciente.",
  },
  {
    icon: Timer,
    titulo: "Quince minutos para pagar",
    detalle:
      "La pantalla corre un temporizador visible. Si el paciente registra el pago (Pago Móvil con comprobante o pago en caja), la cita avanza con la referencia y queda pendiente de validación.",
  },
  {
    icon: RefreshCw,
    titulo: "El cupo se libera solo",
    detalle:
      "Si el bloqueo vence o el paciente retrocede en el asistente, releaseLockedSlot marca la cita como 'expirada' o 'cancelada' y el turno vuelve a ofrecerse sin que nadie intervenga.",
  },
]

/** Estados de la cita y su efecto real sobre la disponibilidad. */
const ESTADOS = [
  {
    estado: "pendiente (lock vigente)",
    significado: "Un paciente está pagando en este momento la cita que reservó.",
    efecto: "Bloquea el turno",
    icon: Hourglass,
  },
  {
    estado: "pendiente (lock vencido)",
    significado: "El temporizador terminó y nadie completó el pago.",
    efecto: "No bloquea: se ofrece de nuevo",
    icon: RefreshCw,
  },
  {
    estado: "pendiente_validacion",
    significado: "El paciente reportó un Pago Móvil con referencia y comprobante.",
    efecto: "Bloquea el turno",
    icon: Wallet,
  },
  {
    estado: "pago_en_recepcion",
    significado: "El paciente pagará en caja el día de la consulta.",
    efecto: "Bloquea el turno",
    icon: Wallet,
  },
  {
    estado: "cancelada / expirada",
    significado: "Liberada de forma explícita por el paciente o por vencimiento del bloqueo.",
    efecto: "No bloquea",
    icon: Ban,
  },
] as const

/** Reto 01 · Concurrencia con bloqueos temporales en los turnos. */
export function RetoConcurrencia() {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-zinc-900 text-teal-300">
          <Timer className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Reto 01 · Concurrencia
          </p>
          <h3 className="text-xl font-bold tracking-tight text-zinc-900">
            Que dos pacientes no compren el mismo turno
          </h3>
        </div>
      </div>

      <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-600">
        El asistente de reserva es anónimo: cualquiera con el enlace puede tomar
        un turno sin crear cuenta. Eso significa que dos personas pueden estar
        pagando la misma hora en paralelo, y que la primera puede abandonar el
        proceso después de haber apartado el cupo. La solución no podía ser un
        bloqueo permanente —condenaría los turnos de los pacientes que cambian
        de opinión— ni un índice único en la base —no sabe medir el tiempo
        transcurrido—.
      </p>

      <div className="mt-6">
        <FlujoPasos pasos={FLUJO} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <Panel tone="muted" className="p-5">
          <p className="text-sm font-bold text-zinc-900">
            Ciclo de vida del bloqueo
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            El estado de la cita es el que decide si el turno está ocupado. No hay
            banderas paralelas que puedan quedar desincronizadas.
          </p>
          <ul className="mt-4 space-y-3">
            {ESTADOS.map((fila) => {
              const Icono = fila.icon
              const bloquea = fila.efecto.startsWith("Bloquea")
              return (
                <li
                  key={fila.estado}
                  className="rounded-xl border border-zinc-200 bg-white p-3.5"
                >
                  <p className="flex flex-wrap items-center gap-2">
                    <Icono className="size-4 text-zinc-400" aria-hidden="true" />
                    <span className="font-mono text-xs font-bold text-zinc-800">
                      {fila.estado}
                    </span>
                    <span
                      className={
                        bloquea
                          ? "rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700"
                          : "rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold text-zinc-500"
                      }
                    >
                      {fila.efecto}
                    </span>
                  </p>
                  <p className="mt-1.5 text-xs leading-5 text-zinc-500">
                    {fila.significado}
                  </p>
                </li>
              )
            })}
          </ul>
        </Panel>

        <div className="space-y-4">
          <CodePanel
            ruta="src/app/actions/booking.ts"
            nota="La cita nace bloqueada: el estado 'pendiente' con fecha de expiración es el propio mecanismo de reserva."
          >{`const expiresAtMs = Date.now() + LOCK_DURATION_MINUTES * 60_000 // 15 min
const lockExpiraEn = new Date(expiresAtMs).toISOString()

const payloadBase = {
  tenant_id: doctorRes.data.tenant_id,
  doctor_id: doctorId,
  patient_id: patientId ?? null,
  fecha_hora: combineToISO(date, horaReferencial),
  estado: "pendiente",
  lock_expira_en: lockExpiraEn,
}`}</CodePanel>

          <CodePanel
            ruta="src/app/actions/booking.ts"
            nota="Disponibilidad y liberación: la segunda operación solo aplica si la cita sigue en 'pendiente' (guarda optimista)."
          >{`// El cupo solo está ocupado si el bloqueo sigue vigente
if (cita.estado === "pendiente" && cita.lock_expira_en) {
  return new Date(cita.lock_expira_en).getTime() > ahora
}

// Liberación: 'expirada' si venció, 'cancelada' si el paciente retrocedió
const estado = expirada ? "expirada" : "cancelada"
await supabase.from("appointments")
  .update({ estado })
  .eq("id", appointmentId)
  .eq("estado", "pendiente")`}</CodePanel>

          <Callout
            icon={AlertTriangle}
            titulo="La lección de la migración 0003"
            tone="amber"
          >
            <p className="text-sm leading-6">
              La primera versión protegía la doble reserva con un índice único
              sobre la fecha y el turno. Funcionaba hasta que el bloqueo vencía:
              el índice no sabe medir tiempo, así que los turnos abandonados
              quedaban muertos para siempre. Eliminar esa restricción fue una
              decisión incómoda pero correcta: el control pasó al modelo de datos
              con un estado y una fecha de expiración que sí expresan la regla de
              negocio.
            </p>
          </Callout>
        </div>
      </div>
    </article>
  )
}
