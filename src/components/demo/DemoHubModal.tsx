"use client"

/**
 * DemoHubModal · Modal global con 3 bloques DEMO según el modelo de negocio:
 *  1. Reserva Pública (Paciente)
 *  2. Clínica (Multi-Especialista)
 *  3. Especialista Independiente (Plan Pro)
 *
 * El estado proviene de `DemoHubContext`; se monta una única vez vía portal.
 */
import { createPortal } from "react-dom"
import Link from "next/link"
import {
  CalendarCheck,
  Building2,
  Stethoscope,
  X,
} from "lucide-react"

import {
  DEMO_CLINIC_SLUG,
  DEMO_INDEPENDENT_SLUG,
  DEMO_CREDENCIALES,
  DEMO_ESPECIALISTA,
  DEMO_ESPECIALISTA_INDEPENDIENTE,
} from "@/lib/demo"
import { useDemoHub } from "@/context/DemoHubContext"
import { cn } from "@/lib/utils"

type Accion = { label: string; href: string; primario?: boolean }
type Credencial = { etiqueta: string; valor: string }

type Bloque = {
  id: string
  badge: string
  titulo: string
  descripcion: string
  icono: React.ReactNode
  color: string
  credenciales: Credencial[]
  acciones: Accion[]
}

const BLOQUES: Bloque[] = [
  {
    id: "reserva",
    badge: "DEMO Reserva Pública",
    titulo: "Agendamiento de Citas (Paciente)",
    descripcion: "Portal de reserva directa en línea sin registro.",
    icono: <CalendarCheck className="size-5" aria-hidden="true" />,
    color: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    credenciales: [{ etiqueta: "Acceso", valor: "Sin credenciales requeridas" }],
    acciones: [
      {
        label: "Agendar cita de prueba",
        href: `/${DEMO_CLINIC_SLUG}`,
        primario: true,
      },
    ],
  },
  {
    id: "clinica",
    badge: "DEMO Clínica · Multi-Especialista",
    titulo: "Portal Clínica / Centro Médico",
    descripcion:
      "Gestión administrativa multi-médico, recepción, gestión de personal y agenda grupal.",
    icono: <Building2 className="size-5" aria-hidden="true" />,
    color: "bg-primary/10 text-primary",
    credenciales: [
      {
        etiqueta: "Admin / Recepción",
        valor: `${DEMO_CREDENCIALES.email} · ${DEMO_CREDENCIALES.password}`,
      },
      {
        etiqueta: "Especialista de plantilla",
        valor: `C.I. ${DEMO_ESPECIALISTA.cedula} · Tel. ${DEMO_ESPECIALISTA.telefono}`,
      },
    ],
    acciones: [
      {
        label: "Ir a escritorio de la Clínica DEMO",
        href: `/${DEMO_CLINIC_SLUG}/admin`,
        primario: true,
      },
    ],
  },
  {
    id: "pro",
    badge: "DEMO Especialista Independiente · Plan Pro",
    titulo: "Portal Especialista Independiente",
    descripcion:
      "Agenda personal, gestión de expedientes e historial médico para un único especialista.",
    icono: <Stethoscope className="size-5" aria-hidden="true" />,
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    credenciales: [
      {
        etiqueta: "Especialista Plan Pro",
        valor: `C.I. ${DEMO_ESPECIALISTA_INDEPENDIENTE.cedula} · Tel. ${DEMO_ESPECIALISTA_INDEPENDIENTE.telefono}`,
      },
    ],
    acciones: [
      {
        label: "Ir a escritorio del Especialista DEMO",
        href: `/${DEMO_INDEPENDENT_SLUG}/admin`,
        primario: true,
      },
    ],
  },
]

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
              Tres experiencias según el modelo de negocio.
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

        <div className="mt-5 flex flex-col gap-4">
          {BLOQUES.map((bloque) => (
            <section
              key={bloque.id}
              className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-xl",
                    bloque.color
                  )}
                >
                  {bloque.icono}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {bloque.badge}
                  </span>
                  <span className="font-semibold">{bloque.titulo}</span>
                  <span className="text-xs text-muted-foreground">
                    {bloque.descripcion}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                {bloque.credenciales.map((cred) => (
                  <div
                    key={cred.etiqueta}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed bg-background px-3 py-1.5 text-[12px]"
                  >
                    <span className="text-muted-foreground">
                      {cred.etiqueta}:
                    </span>
                    <strong className="font-mono">{cred.valor}</strong>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {bloque.acciones.map((accion) => (
                  <Link
                    key={accion.href + accion.label}
                    href={accion.href}
                    onClick={closeDemoHub}
                    className={cn(
                      "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors",
                      accion.primario
                        ? "bg-linear-to-r from-teal-600 to-cyan-600 text-white shadow-sm hover:brightness-110"
                        : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    )}
                  >
                    {accion.label}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
