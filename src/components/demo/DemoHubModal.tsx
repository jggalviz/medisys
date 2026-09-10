"use client"

/**
 * DemoHubModal · Acceso centralizado a los entornos DEMO de la plataforma.
 * Botón llamativo que abre un modal con 4 tarjetas de acceso y credenciales.
 */
import { useState } from "react"
import Link from "next/link"
import {
  CalendarCheck,
  LayoutDashboard,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react"

import { DEMO_CLINIC_SLUG, DEMO_CREDENCIALES } from "@/lib/demo"
import { cn } from "@/lib/utils"

type Props = {
  /** Texto del botón que abre el modal. */
  label?: string
  className?: string
}

const ACCESOS = [
  {
    id: "reservar",
    titulo: "Agendamiento Público",
    descripcion: "Reserva en 4 pasos sin crear cuenta.",
    href: `/${DEMO_CLINIC_SLUG}`,
    icono: <CalendarCheck className="size-5" aria-hidden="true" />,
    rol: "Paciente",
    credenciales: [{ etiqueta: "Acceso", valor: "Sin credenciales" }],
    color: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    id: "especialista",
    titulo: "Portal de Especialistas",
    descripcion: "Pacientes, expedientes y evolución de consultas.",
    href: `/${DEMO_CLINIC_SLUG}/especialista/login`,
    icono: <Stethoscope className="size-5" aria-hidden="true" />,
    rol: "Especialista",
    credenciales: [
      { etiqueta: "C.I.", valor: "12345678" },
      { etiqueta: "Teléfono", valor: "0412-1234567" },
    ],
    color: "bg-primary/10 text-primary",
  },
  {
    id: "paciente",
    titulo: "Portal de Pacientes",
    descripcion: "Citas, historial médico y estatus de pagos.",
    href: `/${DEMO_CLINIC_SLUG}/paciente/login`,
    icono: <UserRound className="size-5" aria-hidden="true" />,
    rol: "Paciente",
    credenciales: [
      { etiqueta: "C.I.", valor: "87654321" },
      { etiqueta: "Teléfono", valor: "0414-7654321" },
    ],
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "admin",
    titulo: "Panel de Recepción / Administración",
    descripcion: "Recepción, pagos, especialistas y configuración.",
    href: `/${DEMO_CLINIC_SLUG}/login`,
    icono: <LayoutDashboard className="size-5" aria-hidden="true" />,
    rol: "Staff",
    credenciales: [
      { etiqueta: "Correo", valor: DEMO_CREDENCIALES.email },
      { etiqueta: "Clave", valor: DEMO_CREDENCIALES.password },
    ],
    color: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  },
] as const

export function DemoHubModal({ label = "Entornos DEMO", className }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700",
          className
        )}
      >
        <span aria-hidden="true">🧪</span>
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Entornos DEMO de Medisys"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex flex-col">
                <span className="text-sm font-semibold">
                  🧪 Entornos DEMO
                </span>
                <span className="text-xs text-muted-foreground">
                  Explora cada portal con las credenciales sugeridas.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 overflow-auto p-4">
              {ACCESOS.map((acceso) => (
                <Link
                  key={acceso.id}
                  href={acceso.href}
                  onClick={() => setOpen(false)}
                  className="group flex items-start gap-3 rounded-2xl border bg-card p-3.5 text-left transition-colors hover:bg-muted/40"
                >
                  <span
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-xl",
                      acceso.color
                    )}
                  >
                    {acceso.icono}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{acceso.titulo}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {acceso.rol}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {acceso.descripcion}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {acceso.credenciales.map((cred) => (
                        <span
                          key={cred.etiqueta}
                          className="rounded-full border border-dashed bg-background px-2 py-0.5 text-[11px] font-medium"
                        >
                          {cred.etiqueta}: <strong>{cred.valor}</strong>
                        </span>
                      ))}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
