"use client"

/** Dashboard central del Super Admin: KPIs + tabla de tenants con acciones. */
import { useState } from "react"
import Link from "next/link"
import { Building2, CalendarClock, Check, LoaderCircle, Stethoscope, Users } from "lucide-react"

import {
  toggleTenantActive,
  updateTenantMaxEspecialistas,
  type SuperAdminSnapshot,
  type TenantAdminRow,
} from "@/app/actions/super-admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Props = { snapshot: SuperAdminSnapshot }

function formatoFecha(iso: string): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso))
}

export function SuperAdminDashboard({ snapshot }: Props) {
  const [tenants, setTenants] = useState<TenantAdminRow[]>(snapshot.tenants)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [maxDraft, setMaxDraft] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState<string | null>(null)

  const { metrics } = snapshot

  async function alternar(tenant: TenantAdminRow) {
    if (busyId) return
    setBusyId(tenant.id)
    const resultado = await toggleTenantActive(tenant.id, !tenant.is_active)
    setBusyId(null)
    if (resultado.ok) {
      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenant.id ? { ...t, is_active: resultado.data.is_active } : t
        )
      )
    } else {
      setAviso(resultado.message)
    }
  }

  async function guardarMax(tenant: TenantAdminRow) {
    if (busyId) return
    const valor = Number((maxDraft[tenant.id] ?? "").replace(/\D/g, ""))
    if (!Number.isFinite(valor) || valor < 1) {
      setAviso("Indica un número de especialistas válido (mínimo 1).")
      return
    }
    setBusyId(tenant.id)
    const resultado = await updateTenantMaxEspecialistas(tenant.id, valor)
    setBusyId(null)
    if (resultado.ok) {
      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenant.id
            ? { ...t, max_especialistas: resultado.data.max_especialistas }
            : t
        )
      )
      setMaxDraft((prev) => ({ ...prev, [tenant.id]: "" }))
    } else {
      setAviso(resultado.message)
    }
  }

  const kpis = [
    { id: "total", label: "Tenants", valor: metrics.totalTenants, icono: <Building2 className="size-4" /> },
    { id: "pro", label: "Plan PRO", valor: metrics.pro, icono: <Stethoscope className="size-4" /> },
    { id: "clinica", label: "Plan Clínica", valor: metrics.clinica, icono: <Building2 className="size-4" /> },
    { id: "activos", label: "Activos", valor: metrics.activos, icono: <Check className="size-4" /> },
    { id: "doctores", label: "Especialistas", valor: metrics.totalDoctores, icono: <Stethoscope className="size-4" /> },
    { id: "citas", label: "Citas totales", valor: metrics.totalCitas, icono: <CalendarClock className="size-4" /> },
  ]

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Users className="size-5" />
        </span>
        <div>
          <h1 className="text-lg font-bold tracking-tight">Dashboard Central</h1>
          <p className="text-sm text-muted-foreground">
            Vista global de clínicas, planes y uso de la plataforma.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <article key={kpi.id} className="flex flex-col gap-1.5 rounded-2xl border bg-card p-3.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {kpi.icono}
            </span>
            <span className="text-[12px] font-medium text-muted-foreground">{kpi.label}</span>
            <span className="text-2xl font-bold tracking-tight tabular-nums">{kpi.valor}</span>
          </article>
        ))}
      </section>

      {aviso && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {aviso}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Clínica</th>
                <th className="px-4 py-2.5">Slug</th>
                <th className="px-4 py-2.5">Plan</th>
                <th className="px-4 py-2.5">Máx. esp.</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5">Teléfono</th>
                <th className="px-4 py-2.5">Creado</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link
                      href={`/super-admin/clientes/${tenant.id}`}
                      className="font-medium text-primary hover:underline"
                      title="Ver ficha completa del cliente"
                    >
                      {tenant.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/${tenant.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      title="Abrir la página pública en una nueva pestaña"
                    >
                      {tenant.slug}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        tenant.plan_type === "PRO"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      {tenant.plan_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {tenant.plan_type === "PRO" ? (
                      <span className="tabular-nums text-muted-foreground">1 (fijo)</span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <Input
                          value={
                            maxDraft[tenant.id] ?? String(tenant.max_especialistas)
                          }
                          onChange={(e) =>
                            setMaxDraft((prev) => ({
                              ...prev,
                              [tenant.id]: e.target.value,
                            }))
                          }
                          className="h-8 w-16 text-center tabular-nums"
                          inputMode="numeric"
                          aria-label={`Máximo de especialistas de ${tenant.nombre}`}
                        />
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={busyId === tenant.id}
                          onClick={() => void guardarMax(tenant)}
                        >
                          {busyId === tenant.id ? (
                            <LoaderCircle className="size-3 animate-spin" />
                          ) : (
                            "Guardar"
                          )}
                        </Button>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void alternar(tenant)}
                      disabled={busyId === tenant.id}
                      aria-pressed={tenant.is_active}
                      aria-label={`Activar o desactivar ${tenant.nombre}`}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        tenant.is_active
                          ? "bg-emerald-500"
                          : "bg-zinc-300 dark:bg-zinc-700"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block size-4 rounded-full bg-white shadow transition-transform",
                          tenant.is_active ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {tenant.telefono ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatoFecha(tenant.created_at)}
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Aún no hay clínicas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
