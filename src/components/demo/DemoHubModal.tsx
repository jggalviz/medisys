"use client"

/**
 * DemoHubModal · Renderiza UN único modal global vía React Portal.
 * El estado proviene de `DemoHubContext` (ver `src/context/DemoHubContext.tsx`).
 * No incluye botón trigger: los botones llaman `openDemoHub()`.
 */
import { createPortal } from "react-dom"
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
import { useDemoHub } from "@/context/DemoHubContext"

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

export function DemoHubModal() {
  const { isOpen, closeDemoHub } = useDemoHub()

  if (!isOpen || typeof document === "undefined") return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Entornos DEMO de Medisys"
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDemoHub()
      }}
    >
      <div className="relative z-[10000] my-auto w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-semibold">🧪 Entornos DEMO</span>
            <span className="text-xs text-muted-foreground">
              Explora cada portal con las credenciales sugeridas.
            </span>
          </div>
          <button
            type="button"
            onClick={closeDemoHub}
            aria-label="Cerrar"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {ACCESOS.map((acceso) => (
            <Link
              key={acceso.id}
              href={acceso.href}
              onClick={closeDemoHub}
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
    </div>,
    document.body
  )
}
