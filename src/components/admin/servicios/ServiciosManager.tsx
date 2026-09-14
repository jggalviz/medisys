"use client"

/**
 * MEDISYS · Catálogo de servicios médicos y honorarios
 * ----------------------------------------------------
 * Lista, crea, edita, activa/desactiva y elimina servicios de la clínica.
 *
 * Reglas fiscales relevantes (Venezuela):
 *   - `taxable = false` (por defecto): servicio médico directo EXENTO de IVA.
 *   - `taxable = true`: se aplica la alícuota general del 16%.
 *   - La comisión del especialista puede ser un porcentaje o un monto fijo USD.
 *
 * Persiste contra `/api/admin/services` y `/api/admin/services/:id`.
 */
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Stethoscope,
  Trash2,
  X,
} from "lucide-react"

import type { ServicioMedicoDTO } from "@/types/admin"
import type { DoctorCommissionType } from "@/types/database"
import type { ServicioMedicoInput } from "@/lib/validations/admin"
import { servicioMedicoSchema } from "@/lib/validations/admin"
import {
  apiActualizarServicio,
  apiAlternarServicio,
  apiCrearServicio,
  apiEliminarServicio,
} from "@/lib/api-admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  calcularHonorarioMedico,
  calcularTotalServicio,
  redondear2,
  TIPO_COMISION_LABEL,
} from "@/lib/fiscal-ve"
import { formatBs, formatUSD } from "@/lib/format"
import { cn } from "@/lib/utils"

type Toast = { tipo: "ok" | "error"; mensaje: string } | null

const VACIO: ServicioMedicoInput = {
  title: "",
  code: "",
  priceUSD: 0,
  taxable: false,
  doctorCommissionType: "PERCENTAGE",
  doctorCommissionValue: 0,
  doctorId: null,
  activo: true,
}

function aFormulario(servicio: ServicioMedicoDTO): ServicioMedicoInput {
  return {
    title: servicio.title,
    code: servicio.code,
    priceUSD: servicio.priceUSD,
    taxable: servicio.taxable,
    doctorCommissionType: servicio.doctorCommissionType,
    doctorCommissionValue: servicio.doctorCommissionValue,
    doctorId: servicio.doctorId,
    activo: servicio.activo,
  }
}

export function ServiciosManager({
  clinicSlug,
  serviciosIniciales,
  tasaBCV,
  puedeEditar,
}: {
  clinicSlug: string
  serviciosIniciales: ServicioMedicoDTO[]
  /** Tasa BCV vigente (Bs por USD) para mostrar precios en bolívares. */
  tasaBCV: number
  puedeEditar: boolean
}) {
  const [servicios, setServicios] = useState<ServicioMedicoDTO[]>(
    serviciosIniciales
  )
  const [form, setForm] = useState<ServicioMedicoInput>(VACIO)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [formVisible, setFormVisible] = useState(false)
  const [query, setQuery] = useState("")
  const [ocupadoId, setOcupadoId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState<Toast>(null)
  const router = useRouter()

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 4500)
    return () => window.clearTimeout(id)
  }, [toast])

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return servicios
    return servicios.filter(
      (servicio) =>
        servicio.title.toLowerCase().includes(q) ||
        servicio.code.toLowerCase().includes(q)
    )
  }, [servicios, query])

  const totales = useMemo(() => {
    const activos = servicios.filter((servicio) => servicio.activo)
    return {
      total: servicios.length,
      activos: activos.length,
      exentos: servicios.filter((servicio) => !servicio.taxable).length,
    }
  }, [servicios])

  function reemplazar(servicio: ServicioMedicoDTO) {
    setServicios((previo) => {
      const otros = previo.filter((item) => item.id !== servicio.id)
      return [...otros, servicio].sort((a, b) =>
        a.title.localeCompare(b.title, "es")
      )
    })
  }

  function abrirNuevo() {
    setForm(VACIO)
    setEditandoId(null)
    setFormVisible(true)
  }

  function abrirEdicion(servicio: ServicioMedicoDTO) {
    setForm(aFormulario(servicio))
    setEditandoId(servicio.id)
    setFormVisible(true)
  }

  function cerrarForm() {
    setFormVisible(false)
    setEditandoId(null)
    setForm(VACIO)
  }

  async function guardar() {
    const valido = servicioMedicoSchema.safeParse(form)
    if (!valido.success) {
      setToast({ tipo: "error", mensaje: valido.error.message })
      return
    }

    setGuardando(true)
    const respuesta = editandoId
      ? await apiActualizarServicio(clinicSlug, editandoId, valido.data)
      : await apiCrearServicio(clinicSlug, valido.data)
    setGuardando(false)

    if (!respuesta.ok) {
      setToast({ tipo: "error", mensaje: respuesta.message })
      return
    }

    reemplazar(respuesta.data)
    setToast({
      tipo: "ok",
      mensaje: editandoId
        ? "Servicio actualizado."
        : `Servicio «${respuesta.data.title}» creado.`,
    })
    cerrarForm()
    router.refresh()
  }

  async function alternar(servicio: ServicioMedicoDTO) {
    setOcupadoId(servicio.id)
    const respuesta = await apiAlternarServicio(
      clinicSlug,
      servicio.id,
      !servicio.activo
    )
    setOcupadoId(null)

    if (!respuesta.ok) {
      setToast({ tipo: "error", mensaje: respuesta.message })
      return
    }
    reemplazar(respuesta.data)
    setToast({
      tipo: "ok",
      mensaje: respuesta.data.activo
        ? "Servicio habilitado en la reserva."
        : "Servicio deshabilitado (no se ofrecerá en la reserva).",
    })
  }

  async function eliminar(servicio: ServicioMedicoDTO) {
    setOcupadoId(servicio.id)
    const respuesta = await apiEliminarServicio(clinicSlug, servicio.id)
    setOcupadoId(null)

    if (!respuesta.ok) {
      setToast({ tipo: "error", mensaje: respuesta.message })
      return
    }
    setServicios((previo) =>
      previo.filter((item) => item.id !== servicio.id)
    )
    setToast({ tipo: "ok", mensaje: `Servicio «${servicio.title}» eliminado.` })
    router.refresh()
  }

  const desglose = calcularTotalServicio(form.priceUSD, form.taxable)
  const honorario = calcularHonorarioMedico(
    form.priceUSD,
    form.doctorCommissionType,
    form.doctorCommissionValue
  )

  return (
    <div className="flex flex-col gap-5">
      <section className="grid grid-cols-3 gap-3">
        <Tarjeta titulo="Servicios" valor={String(totales.total)} />
        <Tarjeta titulo="Activos" valor={String(totales.activos)} />
        <Tarjeta titulo="Exentos de IVA" valor={String(totales.exentos)} />
      </section>

      {toast && (
        <p
          role="status"
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
            toast.tipo === "ok"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-destructive/10 text-destructive"
          )}
        >
          {toast.tipo === "ok" && (
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          )}
          {toast.mensaje}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(evento) => setQuery(evento.target.value)}
            placeholder="Buscar por nombre o código…"
            className="pl-9"
            aria-label="Buscar servicio"
          />
        </div>
        {puedeEditar && (
          <Button
            type="button"
            onClick={abrirNuevo}
            className="h-11 shrink-0 gap-2 rounded-xl px-4"
          >
            <Plus className="size-4" aria-hidden="true" />
            Nuevo servicio
          </Button>
        )}
      </div>

      {formVisible && (
        <section
          aria-label="Formulario de servicio"
          className="flex flex-col gap-4 rounded-2xl border border-dashed bg-card p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <Stethoscope className="size-4 text-primary" aria-hidden="true" />
              {editandoId ? "Editar servicio" : "Nuevo servicio"}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Cerrar formulario"
              onClick={cerrarForm}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-sm font-medium">
                Nombre del servicio *
              </Label>
              <Input
                value={form.title}
                onChange={(evento) =>
                  setForm((previo) => ({
                    ...previo,
                    title: evento.target.value,
                  }))
                }
                placeholder="Consulta Cardiología General"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">Código interno *</Label>
              <Input
                value={form.code}
                onChange={(evento) =>
                  setForm((previo) => ({
                    ...previo,
                    code: evento.target.value.toUpperCase(),
                  }))
                }
                placeholder="CAR-001"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">Precio (USD) *</Label>
              <Input
                value={String(form.priceUSD)}
                onChange={(evento) =>
                  setForm((previo) => ({
                    ...previo,
                    priceUSD: Number(
                      evento.target.value
                        .replace(",", ".")
                        .replace(/[^\d.]/g, "")
                    ),
                  }))
                }
                inputMode="decimal"
                placeholder="25.00"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">
                Tipo de honorario médico
              </Label>
              <select
                value={form.doctorCommissionType}
                onChange={(evento) =>
                  setForm((previo) => ({
                    ...previo,
                    doctorCommissionType: evento.target
                      .value as DoctorCommissionType,
                  }))
                }
                className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="PERCENTAGE">
                  {TIPO_COMISION_LABEL.PERCENTAGE}
                </option>
                <option value="FIXED">{TIPO_COMISION_LABEL.FIXED}</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">
                {form.doctorCommissionType === "PERCENTAGE"
                  ? "Porcentaje para el médico (%)"
                  : "Monto fijo para el médico (USD)"}
              </Label>
              <Input
                value={String(form.doctorCommissionValue)}
                onChange={(evento) =>
                  setForm((previo) => ({
                    ...previo,
                    doctorCommissionValue: Number(
                      evento.target.value
                        .replace(",", ".")
                        .replace(/[^\d.]/g, "")
                    ),
                  }))
                }
                inputMode="decimal"
                placeholder={
                  form.doctorCommissionType === "PERCENTAGE" ? "40" : "10.00"
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.taxable}
                onChange={(evento) =>
                  setForm((previo) => ({
                    ...previo,
                    taxable: evento.target.checked,
                  }))
                }
                className="size-4 rounded border-input"
              />
              Sujeto a IVA (16%). Déjalo sin marcar si es un servicio médico
              directo (exento).
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(evento) =>
                  setForm((previo) => ({
                    ...previo,
                    activo: evento.target.checked,
                  }))
                }
                className="size-4 rounded border-input"
              />
              Disponible en la reserva
            </label>
          </div>

          <div className="grid gap-3 rounded-xl bg-muted/40 p-3 text-sm sm:grid-cols-4">
            <span className="flex flex-col">
              <span className="text-xs text-muted-foreground">Subtotal</span>
              <strong className="tabular-nums">
                {formatUSD(desglose.subtotal)}
              </strong>
            </span>
            <span className="flex flex-col">
              <span className="text-xs text-muted-foreground">
                IVA {Math.round(desglose.alicuota * 100)}%
              </span>
              <strong className="tabular-nums">{formatUSD(desglose.iva)}</strong>
            </span>
            <span className="flex flex-col">
              <span className="text-xs text-muted-foreground">
                Total al paciente
              </span>
              <strong className="tabular-nums">{formatUSD(desglose.total)}</strong>
            </span>
            <span className="flex flex-col">
              <span className="text-xs text-muted-foreground">
                Honorario médico
              </span>
              <strong className="tabular-nums">{formatUSD(honorario)}</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => void guardar()}
              disabled={guardando}
              className="h-11 gap-2 rounded-xl px-5"
            >
              {guardando && <LoaderCircle className="size-4 animate-spin" />}
              {editandoId ? "Guardar cambios" : "Crear servicio"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={cerrarForm}
              className="h-11 gap-2 rounded-xl"
            >
              Cancelar
            </Button>
          </div>
        </section>
      )}

      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card px-4 py-10 text-center">
          <Stethoscope className="size-7 text-muted-foreground/50" />
          <p className="text-sm font-medium">
            {servicios.length === 0
              ? "Aún no hay servicios en el catálogo"
              : "Sin resultados para la búsqueda"}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {servicios.length === 0
              ? "Crea tu primer servicio para estandarizar precios y honorarios médicos."
              : "Prueba con otro nombre o código de procedimiento."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtrados.map((servicio) => {
            const total = calcularTotalServicio(
              servicio.priceUSD,
              servicio.taxable
            )
            const honorarioServicio = calcularHonorarioMedico(
              servicio.priceUSD,
              servicio.doctorCommissionType,
              servicio.doctorCommissionValue
            )
            const enBolivares = redondear2(servicio.priceUSD * tasaBCV)

            return (
              <li
                key={servicio.id}
                className={cn(
                  "flex flex-wrap items-start gap-3 rounded-2xl border bg-card p-4",
                  !servicio.activo && "opacity-70"
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">
                      {servicio.title}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
                      {servicio.code}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        servicio.taxable
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      )}
                    >
                      {servicio.taxable ? "IVA 16%" : "Exento"}
                    </span>
                    {!servicio.activo && (
                      <span className="rounded-full bg-zinc-500/15 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                        Inactivo
                      </span>
                    )}
                  </span>

                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span>
                      Precio: <strong className="text-foreground">{formatUSD(servicio.priceUSD)}</strong>{" "}
                      · {formatBs(enBolivares)}
                    </span>
                    <span>
                      Total: {formatUSD(total.total)} (IVA {formatUSD(total.iva)})
                    </span>
                    <span>
                      Honorario: {formatUSD(honorarioServicio)}
                      {servicio.doctorCommissionType === "PERCENTAGE"
                        ? ` (${servicio.doctorCommissionValue}%)`
                        : ""}
                    </span>
                  </span>
                </div>

                {puedeEditar && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar ${servicio.title}`}
                      onClick={() => abrirEdicion(servicio)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={ocupadoId === servicio.id}
                      onClick={() => void alternar(servicio)}
                    >
                      {ocupadoId === servicio.id ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : null}
                      {servicio.activo ? "Deshabilitar" : "Habilitar"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Eliminar ${servicio.title}`}
                      disabled={ocupadoId === servicio.id}
                      onClick={() => void eliminar(servicio)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Tarjeta({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border bg-card p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {titulo}
      </span>
      <span className="text-2xl font-bold tabular-nums">{valor}</span>
    </div>
  )
}
