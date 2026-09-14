"use client"

/**
 * MEDISYS · Sedes de la clínica (estructura multi-sede)
 * ------------------------------------------------------
 * Gestiona las sedes del tenant (`sedes`) y muestra a qué sedes está asignado
 * el usuario actual (`tenant_users.sede_ids`; vacío = todas).
 *
 * Persiste contra `/api/admin/sedes` (GET/POST) y `/api/admin/sedes/:id`
 * (PATCH/DELETE). Solo el rol administrador puede escribir.
 */
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Building,
  CheckCircle2,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import type { SedeDTO } from "@/types/admin"
import { sedeSchema, type SedeInput } from "@/lib/validations/admin"
import {
  apiActualizarSede,
  apiAlternarSede,
  apiCrearSede,
  apiEliminarSede,
} from "@/lib/api-admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type Toast = { tipo: "ok" | "error"; mensaje: string } | null

const VACIA: SedeInput = {
  nombre: "",
  direccion: null,
  telefono: null,
  esPrincipal: false,
  activo: true,
}

export function SedesManager({
  clinicSlug,
  sedesIniciales,
  aviso,
  puedeEditar,
  sedeIdsAsignadas,
}: {
  clinicSlug: string
  sedesIniciales: SedeDTO[]
  aviso: string | null
  puedeEditar: boolean
  sedeIdsAsignadas: string[]
}) {
  const [sedes, setSedes] = useState<SedeDTO[]>(sedesIniciales)
  const [form, setForm] = useState<SedeInput>(VACIA)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [formVisible, setFormVisible] = useState(false)
  const [ocupadoId, setOcupadoId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState<Toast>(null)
  const router = useRouter()

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(id)
  }, [toast])

  function abrirNueva() {
    setForm(VACIA)
    setEditandoId(null)
    setFormVisible(true)
  }

  function abrirEdicion(sede: SedeDTO) {
    setForm({
      nombre: sede.nombre,
      direccion: sede.direccion,
      telefono: sede.telefono,
      esPrincipal: sede.esPrincipal,
      activo: sede.activo,
    })
    setEditandoId(sede.id)
    setFormVisible(true)
  }

  function cerrarForm() {
    setFormVisible(false)
    setEditandoId(null)
    setForm(VACIA)
  }

  function reemplazar(sede: SedeDTO) {
    setSedes((previo) => {
      const otras = previo.filter((item) => item.id !== sede.id)
      return [...otras, sede].sort((a, b) => {
        if (a.esPrincipal !== b.esPrincipal) return a.esPrincipal ? -1 : 1
        return a.nombre.localeCompare(b.nombre, "es")
      })
    })
  }

  async function guardar() {
    const valido = sedeSchema.safeParse(form)
    if (!valido.success) {
      setToast({ tipo: "error", mensaje: valido.error.message })
      return
    }

    setGuardando(true)
    const respuesta = editandoId
      ? await apiActualizarSede(clinicSlug, editandoId, valido.data)
      : await apiCrearSede(clinicSlug, valido.data)
    setGuardando(false)

    if (!respuesta.ok) {
      setToast({ tipo: "error", mensaje: respuesta.message })
      return
    }

    reemplazar(respuesta.data)
    setToast({
      tipo: "ok",
      mensaje: editandoId ? "Sede actualizada." : "Sede creada correctamente.",
    })
    cerrarForm()
    router.refresh()
  }

  async function alternar(sede: SedeDTO) {
    setOcupadoId(sede.id)
    const respuesta = await apiAlternarSede(clinicSlug, sede.id, !sede.activo)
    setOcupadoId(null)

    if (!respuesta.ok) {
      setToast({ tipo: "error", mensaje: respuesta.message })
      return
    }
    reemplazar(respuesta.data)
    setToast({
      tipo: "ok",
      mensaje: respuesta.data.activo
        ? "Sede habilitada."
        : "Sede deshabilitada (no aparecerá en la agenda).",
    })
  }

  async function eliminar(sede: SedeDTO) {
    setOcupadoId(sede.id)
    const respuesta = await apiEliminarSede(clinicSlug, sede.id)
    setOcupadoId(null)

    if (!respuesta.ok) {
      setToast({ tipo: "error", mensaje: respuesta.message })
      return
    }
    setSedes((previo) => previo.filter((item) => item.id !== sede.id))
    setToast({ tipo: "ok", mensaje: `Sede «${sede.nombre}» eliminada.` })
    router.refresh()
  }

  const asignacionGlobal = sedeIdsAsignadas.length === 0

  return (
    <section
      aria-labelledby="sedes-titulo"
      className="mt-6 flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building className="size-5" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col">
            <h2 id="sedes-titulo" className="font-semibold">
              Sedes de la clínica
            </h2>
            <p className="text-sm text-muted-foreground">
              Cada sede tiene su propia agenda y caja. El personal se asigna a
              una o varias sedes.
            </p>
          </div>
        </div>
        {puedeEditar && !formVisible && (
          <Button
            type="button"
            variant="outline"
            onClick={abrirNueva}
            className="h-10 gap-2 rounded-xl"
          >
            <Plus className="size-4" aria-hidden="true" />
            Nueva sede
          </Button>
        )}
      </header>

      <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {asignacionGlobal
          ? "Tu usuario tiene acceso a todas las sedes de la clínica."
          : `Tu usuario está asignado a ${sedeIdsAsignadas.length} sede(s) específica(s).`}
        {aviso ? ` · ${aviso}` : ""}
      </p>

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

      {formVisible && (
        <div className="grid gap-4 rounded-xl border border-dashed p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium">Nombre de la sede *</Label>
            <Input
              value={form.nombre}
              onChange={(evento) =>
                setForm((previo) => ({ ...previo, nombre: evento.target.value }))
              }
              placeholder="Sede Chacao"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium">Teléfono</Label>
            <Input
              value={form.telefono ?? ""}
              onChange={(evento) =>
                setForm((previo) => ({
                  ...previo,
                  telefono: evento.target.value || null,
                }))
              }
              inputMode="tel"
              placeholder="0212-5551234"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-sm font-medium">Dirección</Label>
            <Input
              value={form.direccion ?? ""}
              onChange={(evento) =>
                setForm((previo) => ({
                  ...previo,
                  direccion: evento.target.value || null,
                }))
              }
              placeholder="Av. Francisco de Miranda, Torre Provincial, Caracas"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.esPrincipal}
                onChange={(evento) =>
                  setForm((previo) => ({
                    ...previo,
                    esPrincipal: evento.target.checked,
                  }))
                }
                className="size-4 rounded border-input"
              />
              Sede principal (facturación)
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
              Sede activa
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button
              type="button"
              onClick={() => void guardar()}
              disabled={guardando}
              className="h-10 gap-2 rounded-xl px-4"
            >
              {guardando && <LoaderCircle className="size-4 animate-spin" />}
              {editandoId ? "Guardar cambios" : "Crear sede"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={cerrarForm}
              className="h-10 gap-2 rounded-xl"
            >
              <X className="size-4" aria-hidden="true" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {sedes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center">
          <Building className="size-7 text-muted-foreground/50" />
          <p className="text-sm font-medium">Todavía no hay sedes registradas</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {aviso ??
              "Crea la primera sede para organizar la agenda y la facturación."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-2xl border">
          {sedes.map((sede, index) => (
            <li
              key={sede.id}
              className={cn(
                "flex flex-wrap items-center gap-3 px-4 py-3",
                index !== sedes.length - 1 && "border-b"
              )}
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-2 truncate font-medium">
                  {sede.nombre}
                  {sede.esPrincipal && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      Principal
                    </span>
                  )}
                  {!sede.activo && (
                    <span className="rounded-full bg-zinc-500/15 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                      Inactiva
                    </span>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {[sede.direccion, sede.telefono].filter(Boolean).join(" · ") ||
                    "Sin dirección registrada"}
                </span>
              </div>

              {puedeEditar && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar ${sede.nombre}`}
                    onClick={() => abrirEdicion(sede)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={ocupadoId === sede.id}
                    onClick={() => void alternar(sede)}
                  >
                    {ocupadoId === sede.id ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : null}
                    {sede.activo ? "Deshabilitar" : "Habilitar"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Eliminar ${sede.nombre}`}
                    disabled={ocupadoId === sede.id}
                    onClick={() => void eliminar(sede)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
