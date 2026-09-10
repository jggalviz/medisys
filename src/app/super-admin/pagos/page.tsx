import { getPagosSuscripcionPendientes } from "@/app/actions/super-admin-suscripcion"
import { PagosSuscripcion } from "@/components/super-admin/PagosSuscripcion"
import { Wallet } from "lucide-react"

export default async function PagosSuscripcionPage() {
  const resultado = await getPagosSuscripcionPendientes()

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Wallet className="size-5" />
        </span>
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            Pagos de Suscripción Pendientes
          </h1>
          <p className="text-sm text-muted-foreground">
            Valida los reportes de Pago Móvil. Al aprobar se suman +30 días de
            membresía y la clínica se reactiva.
          </p>
        </div>
      </header>

      {resultado.ok ? (
        <PagosSuscripcion pagos={resultado.data} />
      ) : (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          {resultado.message}
        </div>
      )}
    </div>
  )
}
