"use client"

/** Expediente del paciente + formulario de evolución clínica. */
import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ClipboardList, LoaderCircle, LogOut, Save, Pencil } from "lucide-react"

import {
  getHistorialPaciente,
  guardarEvolucionConsulta,
  type CitaExpediente,
  type HistorialPaciente,
} from "@/app/actions/especialista-portal"
import { logoutPortal } from "@/app/actions/portal-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Props = { pacienteId: string; clinicSlug: string }

type Estado = { estado: "cargando" | "error" | "ok" } & {
  historial?: HistorialPaciente
  mensaje?: string
}

function formatoFecha(iso: string): string {
  if (!iso) return "Fecha por confirmar"
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

export function ExpedienteEspecialista({ pacienteId, clinicSlug }: Props) {
  const [datos, setDatos] = useState<Estado>({ estado: "cargando" })
  const [intento, setIntento] = useState(0)
  const [citaAEditar, setCitaAEditar] = useState<CitaExpediente | null>(null)
  const [form, setForm] = useState({ motivo: "", diagnostico: "", tratamiento: "", notas: "" })
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    getHistorialPaciente(pacienteId).then((resultado) => {
      if (!activo) return
      if (resultado.ok) {
        setDatos({ estado: "ok", historial: resultado.data })
      } else {
        setDatos({ estado: "error", mensaje: resultado.message })
      }
    })
    return () => {
      activo = false
    }
  }, [pacienteId, intento])

  // Cita activa: si hay una seleccionada manualmente para editar la usa, si no busca la primera no finalizada
  const citaActiva =
    citaAEditar ??
    (datos.estado === "ok" && datos.historial
      ? datos.historial.citas.find(
          (c) =>
            c.estado !== "atendido" &&
            c.estado !== "cancelada" &&
            c.estado !== "expirada"
        ) ?? null
      : null)

  // Cargar los inputs al cambiar la cita activa. Se usa el patrón "ajustar
  // estado en render" (sin setState dentro de un efecto) recomendado por el repo.
  const citaActivaId = citaActiva?.id ?? null
  const [citaFormId, setCitaFormId] = useState<string | null>(citaActivaId)
  if (citaFormId !== citaActivaId) {
    setCitaFormId(citaActivaId)
    const registro = citaActiva?.registro
    setForm({
      motivo: registro?.motivo ?? "",
      diagnostico: registro?.diagnostico ?? "",
      tratamiento: registro?.tratamiento ?? "",
      notas: registro?.notas ?? "",
    })
    setAviso(null)
  }

  async function guardarEvolucion() {
    if (!citaActiva || guardando) return
    setGuardando(true)
    setAviso(null)
    const resultado = await guardarEvolucionConsulta(citaActiva.id, form)
    setGuardando(false)
    if (resultado.ok) {
      setForm({ motivo: "", diagnostico: "", tratamiento: "", notas: "" })
      setAviso(
        citaAEditar
          ? "Evolución actualizada correctamente ✓"
          : "Evolución guardada · Cita marcada como Atendida ✓"
      )
      setCitaAEditar(null)
      setIntento((n) => n + 1)
    } else {
      setAviso(resultado.message)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link
            href={`/${clinicSlug}/especialista/dashboard`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Volver a mis pacientes
          </Link>
          <h1 className="text-lg font-bold tracking-tight">Expediente del paciente</h1>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => void logoutPortal("especialista", clinicSlug)}
        >
          <LogOut className="size-4" />
          Cerrar Sesión
        </Button>
      </header>

      {datos.estado === "cargando" && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      )}

      {datos.estado === "error" && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {datos.mensaje}
        </p>
      )}

      {datos.estado === "ok" && datos.historial && (
        <>
          {/* Resumen del paciente */}
          <section className="rounded-2xl border bg-card p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Información de Asistencia
            </h2>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <p>
                <strong>{datos.historial.paciente.nombre}</strong>
              </p>
              <p className="text-muted-foreground">
                {datos.historial.paciente.cedula
                  ? `C.I. ${datos.historial.paciente.cedula}`
                  : "Sin cédula"}
              </p>
              <p className="text-muted-foreground">
                {datos.historial.paciente.telefono ?? "Sin teléfono"}
              </p>
            </div>
          </section>

          {/* Evolución de la consulta del día */}
          <section id="seccion-evolucion" className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold">
                <ClipboardList className="size-4 text-primary" />
                Evolución de la consulta
              </h2>
              {citaAEditar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs text-destructive hover:bg-transparent"
                  onClick={() => setCitaAEditar(null)}
                >
                  Cancelar edición
                </Button>
              )}
            </div>

            {citaActiva ? (
              <div className="mt-3 flex flex-col gap-3">
                <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  {citaAEditar ? "Editando " : "Registrando "} la cita del{" "}
                  <strong>{formatoFecha(citaActiva.fecha_hora)}</strong>
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="evo-motivo">Motivo de la consulta</Label>
                  <Input
                    id="evo-motivo"
                    value={form.motivo}
                    onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="evo-diagnostico">Diagnóstico</Label>
                  <textarea
                    id="evo-diagnostico"
                    value={form.diagnostico}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, diagnostico: e.target.value }))
                    }
                    className="min-h-20 rounded-xl border bg-background p-3 text-sm"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="evo-tratamiento">Indicaciones / Tratamiento</Label>
                    <textarea
                      id="evo-tratamiento"
                      value={form.tratamiento}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, tratamiento: e.target.value }))
                      }
                      className="min-h-24 rounded-xl border bg-background p-3 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="evo-notas">Notas de evolución</Label>
                    <textarea
                      id="evo-notas"
                      value={form.notas}
                      onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
                      className="min-h-24 rounded-xl border bg-background p-3 text-sm"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={() => void guardarEvolucion()}
                  disabled={guardando}
                  className="h-11 gap-2 sm:w-auto"
                >
                  {guardando && <LoaderCircle className="size-4 animate-spin" />}
                  <Save className="size-4" />
                  {citaAEditar ? "Actualizar evolución" : "Guardar evolución y marcar como Atendida"}
                </Button>
                {aviso && <p className="text-sm">{aviso}</p>}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No hay citas activas pendientes de registrar.
              </p>
            )}
          </section>

          {/* Línea de tiempo */}
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Historial de consultas
            </h2>
            {datos.historial.citas.length === 0 ? (
              <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
                Este paciente aún no tiene citas contigo.
              </p>
            ) : (
              <ol className="relative flex flex-col gap-3">
                {datos.historial.citas.map((cita) => (
                  <li key={cita.id} className="relative flex flex-col sm:flex-row items-start justify-between gap-3 rounded-2xl border bg-card p-3">
                    <div className="flex gap-3 w-full">
                      <span
                        className={cn(
                          "mt-1 size-3 shrink-0 rounded-full",
                          cita.estado === "atendido" ? "bg-emerald-500" : "bg-sky-500"
                        )}
                      />
                      <div className="w-full">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold">
                            {formatoFecha(cita.fecha_hora)}
                          </p>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                            {cita.estado}
                          </span>
                        </div>
                        {cita.registro ? (
                          <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                            {cita.registro.motivo && (
                              <>
                                <dt className="font-medium">Motivo</dt>
                                <dd>{cita.registro.motivo}</dd>
                              </>
                            )}
                            {cita.registro.diagnostico && (
                              <>
                                <dt className="font-medium">Diagnóstico</dt>
                                <dd>{cita.registro.diagnostico}</dd>
                              </>
                            )}
                            {cita.registro.tratamiento && (
                              <>
                                <dt className="font-medium">Indicaciones</dt>
                                <dd>{cita.registro.tratamiento}</dd>
                              </>
                            )}
                            {cita.registro.notas && (
                              <>
                                <dt className="font-medium">Notas</dt>
                                <dd>{cita.registro.notas}</dd>
                              </>
                            )}
                          </dl>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Sin evolución registrada.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Botón para editar la consulta desde el historial */}
                    {cita.registro && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 self-end sm:self-start shrink-0 text-xs"
                        onClick={() => {
                          setCitaAEditar(cita)
                          document.getElementById("seccion-evolucion")?.scrollIntoView({ behavior: "smooth" })
                        }}
                      >
                        <Pencil className="size-3.5" />
                        Editar
                      </Button>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  )
}