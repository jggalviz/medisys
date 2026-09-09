"use client"

/** Panel del especialista: lista de pacientes con buscador rápido. */
import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ChevronRight,
  LogOut,
  Search,
  Stethoscope,
  Users,
} from "lucide-react"

import { getPacientesDelEspecialista } from "@/app/actions/especialista-portal"
import { logoutPortal } from "@/app/actions/portal-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Props = { nombre: string; clinicSlug: string }

type Estado = { estado: "cargando" | "error" | "ok" } & {
  pacientes?: { id: string; nombre: string; cedula: string | null; telefono: string | null; ultimaCita: string | null; totalCitas: number }[]
  mensaje?: string
}

export function EspecialistaDashboard({ nombre, clinicSlug }: Props) {
  const [datos, setDatos] = useState<Estado>({ estado: "cargando" })
  const [busqueda, setBusqueda] = useState("")
  const [reintentos, setReintentos] = useState(0)

  useEffect(() => {
    let activo = true
    getPacientesDelEspecialista().then((resultado) => {
      if (!activo) return
      if (resultado.ok) {
        setDatos({ estado: "ok", pacientes: resultado.data })
      } else {
        setDatos({ estado: "error", mensaje: resultado.message })
      }
    })
    return () => {
      activo = false
    }
  }, [reintentos])

  const filtrados = (datos.pacientes ?? []).filter((p) => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return true
    return (
      p.nombre.toLowerCase().includes(q) ||
      (p.cedula ?? "").replace(/\D/g, "").includes(q.replace(/\D/g, ""))
    )
  })

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Stethoscope className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight">{nombre}</h1>
            <p className="text-sm text-muted-foreground">
              Portal del Especialista · Mis pacientes
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => void logoutPortal("especialista", clinicSlug)}
        >
          <LogOut className="size-4" />
          Cerrar Sesión
        </Button>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por cédula o nombre…"
          className="pl-9"
        />
      </div>

      {datos.estado === "cargando" && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} className="h-[72px] w-full rounded-2xl" />
          ))}
        </div>
      )}

      {datos.estado === "error" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <p>{datos.mensaje}</p>
          <Button variant="outline" onClick={() => setReintentos((n) => n + 1)}>
            Reintentar
          </Button>
        </div>
      )}

      {datos.estado === "ok" && filtrados.length === 0 && (
        <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          {datos.pacientes?.length === 0
            ? "Aún no tienes pacientes con citas."
            : "No hay pacientes que coincidan con la búsqueda."}
        </p>
      )}

      {datos.estado === "ok" && filtrados.length > 0 && (
        <ul className="flex flex-col overflow-hidden rounded-2xl border bg-card">
          {filtrados.map((p, index) => (
            <li key={p.id} className={cn("flex", index > 0 && "border-t")}>
              <Link
                href={`/${clinicSlug}/especialista/pacientes/${p.id}`}
                className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                  <Users className="size-4" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{p.nombre}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {p.cedula ? `C.I. ${p.cedula}` : "Sin cédula"} ·{" "}
                    {p.telefono ?? "Sin teléfono"} · {p.totalCitas}{" "}
                    {p.totalCitas === 1 ? "cita" : "citas"}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground/40" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
