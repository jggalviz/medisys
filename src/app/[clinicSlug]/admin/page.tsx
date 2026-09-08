import Link from "next/link"
import type { Metadata } from "next"

import { ArrowLeft, ArrowRight, CalendarClock, LayoutDashboard } from "lucide-react"

type AdminPageProps = {
  params: Promise<{ clinicSlug: string }>
}

/**
 * Vista de administración / recepción del tenant (work in progress).
 * URL futura: /[clinicSlug]/admin (ej. https://medisys.com.ve/clinica-demo/admin).
 *
 * En la siguiente fase se conectará con la autenticación del personal,
 * la agenda del día, confirmación de pagos y gestión de reservas.
 */
export const metadata: Metadata = {
  title: "Panel de la clínica | Medisys",
  robots: { index: false },
}

export default async function AdminPage({ params }: AdminPageProps) {
  const { clinicSlug } = await params

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 py-6">
      <header className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LayoutDashboard className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {clinicSlug} · Administración
          </span>
          <h1 className="truncate text-lg font-semibold tracking-tight">
            Recepción y reservas
          </h1>
        </div>
      </header>

      <section
        className="flex flex-col gap-3"
        aria-label="Módulos de administración"
      >
        <Link
          href={`/${clinicSlug}/admin/recepcion`}
          className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-muted/40"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarClock className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-semibold">Recepción del día</span>
            <span className="text-sm text-muted-foreground">
              Cola por turno, llegadas, cobros en caja y consultas.
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-muted-foreground/50" />
        </Link>

        <Link
          href={`/${clinicSlug}/admin/pagos`}
          className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-muted/40"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LayoutDashboard className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-semibold">Verificación de pagos</span>
            <span className="text-sm text-muted-foreground">
              Comprobantes en línea pendientes de aprobar o rechazar.
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-muted-foreground/50" />
        </Link>
      </section>

      <nav className="flex flex-col gap-2">
        <Link
          href={`/${clinicSlug}`}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background text-base font-medium transition-colors hover:bg-muted/40"
        >
          <ArrowLeft className="size-4" />
          Volver a la página de reserva
        </Link>
      </nav>
    </main>
  )
}
