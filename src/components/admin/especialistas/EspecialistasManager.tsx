"use client"

/**
 * Vista administrativa de especialistas (CRUD + horarios).
 */
import { useEffect, useMemo, useState } from "react"
import {
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react"

import type { EspecialistaInput, EspecialistaItem } from "@/app/actions/doctors"
import {
  createEspecialista,
  deleteEspecialista,
  getEspecialistas,
  toggleEspecialista,
  updateEspecialista,
} from "@/app/actions/doctors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const DIAS_LABEL = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const TURNO_LABEL = { manana: "Mañana", tarde: "Tarde", ambos: "Ambos" } as const

type Toast = { tipo: "ok" | "error"; mensaje: string } | null

const VACIO: EspecialistaInput = {
  nombre: "",
  especialidad: "",
  cedula: null,
  telefono: null,
  dias_atencion: [],
  turno_habitual: "ambos",
  activo: true,
}

function Skeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((n) => (
        <div
          key={n}
          className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
        >
          <div className="h-5 w-1/2 animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-1/3 animate-pulse rounded-full bg-muted" />
          <div className="h-8 w-24 animate-pulse rounded-xl bg-muted" />
        </div>
      ))}
    </div>
  )
}

export function EspecialistasManager({ tenantId }: { tenantId: string }) {
  const [items, setItems] = useState<EspecialistaItem[]>([])
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading")
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState("")
  const [modal, setModal] = useState<null | { item: EspecialistaItem | null }>(
    null
  )
  const [form, setForm] = useState<EspecialistaInput>(VACIO)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    void getEspecialistas(tenantId).then((result) => {
      if (!active) return
      if (result.ok) {
        setItems(result.data)
        setStatus("ok")
      } else {
        setStatus("error")
        setError(result.message)
      }
    })
    return () => {
      active = false
    }
  }, [tenantId, attempt])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(id)
  }, [toast])

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) =>
        item.nombre.toLowerCase().includes(q) ||
        item.especialidad.toLowerCase().includes(q)
    )
  }, [items, query])

  function abrirNuevo() {
    setForm(VACIO)
    setModal({ item: null })
  }

  function abrirEditar(item: EspecialistaItem) {
    setForm({
      nombre: item.nombre,
      especialidad: item.especialidad,
      cedula: item.cedula ?? "",
      telefono: item.telefono ?? "",
      dias_atencion: item.dias_atencion,
      turno_habitual: item.turno_habitual,
      activo: item.activo,
    })
    setModal({ item })
  }

  function toggleDia(dia: number) {
    setForm((prev) => ({
      ...prev,
      dias_atencion: prev.dias_atencion.includes(dia)
        ? prev.dias_atencion.filter((d) => d !== dia)
        : [...prev.dias_atencion, dia].sort((a, b) => a - b),
    }))
  }

  function avisar(resultado: { ok: boolean; message?: string }, okMensaje: string) {
    if (resultado.ok) {
      setToast({ tipo: "ok", mensaje: okMensaje })
    } else {
      setToast({
        tipo: "error",
        mensaje: resultado.message ?? "Ocurrió un error.",
      })
    }
  }

  async function guardar() {
    if (saving || !modal) return
    setSaving(true)
    const item = modal.item
    const resultado = item
      ? await updateEspecialista(tenantId, item.id, form)
      : await createEspecialista(tenantId, form)
    setSaving(false)

    if (resultado.ok) {
      setItems((prev) =>
        item
          ? prev.map((e) => (e.id === item.id ? resultado.data : e))
          : [...prev, resultado.data]
      )
      setModal(null)
      avisar(resultado, item ? "Especialista actualizado ✓" : "Especialista creado ✓")
    } else {
      avisar(resultado, "")
    }
  }

  async function alternar(item: EspecialistaItem) {
    if (busyId) return
    setBusyId(item.id)
    const resultado = await toggleEspecialista(tenantId, item.id, !item.activo)
    setBusyId(null)
    if (resultado.ok) {
      setItems((prev) =>
        prev.map((e) => (e.id === item.id ? resultado.data : e))
      )
    } else {
      avisar(resultado, "")
    }
  }

  async function eliminar(item: EspecialistaItem) {
    if (busyId) return
    setBusyId(item.id)
    const resultado = await deleteEspecialista(tenantId, item.id)
    setBusyId(null)
    if (resultado.ok) {
      setItems((prev) => prev.filter((e) => e.id !== item.id))
      avisar(resultado, "Especialista eliminado")
    } else {
      avisar(resultado, "")
    }
  }

    return (
    <div className="mt-6 flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o especialidad…"
            className="pl-9"
          />
        </div>
        <Button onClick={abrirNuevo} className="gap-1.5">
          <Plus className="size-4" />
          Agregar Especialista
        </Button>
      </div>

      {toast && (
        <div
          role="status"
          className={cn(
            "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm",
            toast.tipo === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          {toast.tipo === "ok" ? "✅" : <ShieldAlert className="size-4" />}
          {toast.mensaje}
        </div>
      )}

      {status === "loading" && <Skeleton />}

      {status === "error" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">No se pudo cargar</p>
          <p className="text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            onClick={() => {
              setStatus("loading")
              setError(null)
              setAttempt((n) => n + 1)
            }}
          >
            Reintentar
          </Button>
        </div>
      )}

      {status === "ok" && filtrados.length === 0 && (
        <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          No hay especialistas que coincidan.
        </p>
      )}

      {status === "ok" && filtrados.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((item) => (
            <article
              key={item.id}
              className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-semibold">{item.nombre}</span>
                  <span className="truncate text-sm text-primary">
                    {item.especialidad}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {[item.cedula && `Coleg.: ${item.cedula}`, item.telefono]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos de contacto"}
                  </span>
                </div>
                <Switch
                  activo={item.activo}
                  disabled={busyId === item.id}
                  onToggle={() => void alternar(item)}
                  ariaLabel={`Activar ${item.nombre}`}
                />
              </div>

              <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                <span className="font-semibold uppercase tracking-wide">
                  Días:
                </span>
                {item.dias_atencion.length > 0 ? (
                  item.dias_atencion.map((dia) => (
                    <span
                      key={dia}
                      className="rounded-full bg-muted px-2 py-0.5"
                    >
                      {DIAS_LABEL[dia - 1]}
                    </span>
                  ))
                ) : (
                  <span>Sin días configurados</span>
                )}
                <span className="ml-1 rounded-full bg-muted px-2 py-0.5">
                  Turno: {TURNO_LABEL[item.turno_habitual]}
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => abrirEditar(item)}
                >
                  <Pencil className="size-3.5" />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-destructive"
                  disabled={busyId === item.id}
                  onClick={() => void eliminar(item)}
                >
                  {busyId === item.id ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  Eliminar
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal Agregar / Editar */}
      {modal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={modal.item ? "Editar especialista" : "Agregar especialista"}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) setModal(null)
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold">
                {modal.item
                  ? `Editar · ${modal.item.nombre}`
                  : "Agregar Especialista"}
              </span>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label="Cerrar"
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4 overflow-auto px-4 py-4">
              <Campo label="Nombre completo *">
                <Input
                  value={form.nombre}
                  placeholder="Dra. María Rivas"
                  onChange={(e) =>
                    setForm((p) => ({ ...p, nombre: e.target.value }))
                  }
                />
              </Campo>
              <Campo label="Especialidad *">
                <Input
                  value={form.especialidad}
                  placeholder="Pediatría"
                  onChange={(e) =>
                    setForm((p) => ({ ...p, especialidad: e.target.value }))
                  }
                />
              </Campo>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo label="Cédula / Colegiado">
                  <Input
                    value={form.cedula ?? ""}
                    placeholder="V-12345678"
                    onChange={(e) =>
                      setForm((p) => ({ ...p, cedula: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Formatos válidos: V-12345678, V12345678 o solo 12345678.
                  </p>
                </Campo>
                <Campo label="Teléfono">
                  <Input
                    value={form.telefono ?? ""}
                    inputMode="tel"
                    onChange={(e) =>
                      setForm((p) => ({ ...p, telefono: e.target.value }))
                    }
                  />
                </Campo>
              </div>

              <Campo label="Turno habitual">
                <select
                  value={form.turno_habitual}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      turno_habitual: e.target
                        .value as EspecialistaInput["turno_habitual"],
                    }))
                  }
                  className="h-10 rounded-xl border bg-background px-3 text-sm"
                >
                  <option value="manana">Mañana</option>
                  <option value="tarde">Tarde</option>
                  <option value="ambos">Ambos</option>
                </select>
              </Campo>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Días de atención</span>
                <div className="flex flex-wrap gap-1.5">
                  {DIAS_LABEL.map((label, index) => {
                    const dia = index + 1
                    const activo = form.dias_atencion.includes(dia)
                    return (
                      <button
                        key={dia}
                        type="button"
                        aria-pressed={activo}
                        onClick={() => toggleDia(dia)}
                        className={cn(
                          "h-9 rounded-full border px-3.5 text-sm font-medium transition-colors",
                          activo
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-muted/50"
                        )}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">
                  Activo en el wizard
                </span>
                <Switch
                  activo={form.activo ?? true}
                  onToggle={(valor) =>
                    setForm((p) => ({ ...p, activo: valor }))
                  }
                  ariaLabel="Activo en el wizard"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 border-t px-4 py-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setModal(null)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void guardar()}
                disabled={saving}
                className="flex-1 gap-2"
              >
                {saving && <LoaderCircle className="size-4 animate-spin" />}
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function Campo({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  )
}

function Switch({
  activo,
  onToggle,
  ariaLabel,
  disabled = false,
}: {
  activo: boolean
  onToggle: (valor: boolean) => void
  ariaLabel: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onToggle(!activo)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
        activo ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700",
        disabled && "opacity-50"
      )}
    >
      <span
        className={cn(
          "inline-block size-5 rounded-full bg-white shadow transition-transform",
          activo ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  )
}