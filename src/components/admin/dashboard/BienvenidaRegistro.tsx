/**
 * MEDISYS · Aviso de bienvenida del registro público.
 *
 * Se muestra en el panel (`/[clinicSlug]/admin?bienvenida=1`) justo después de
 * crear la cuenta: confirma la activación, entrega el enlace público de reservas
 * y muestra el consumo de la prueba gratuita (mismo contador que promete la
 * landing: 10 reservas incluidas).
 */
import Link from "next/link"
import { ArrowRight, Link2, PartyPopper, Wallet } from "lucide-react"

import type { ConsumoPrueba } from "@/lib/trial"
import { enlacePublico } from "@/lib/site"

type Props = {
  clinicSlug: string
  consumo: ConsumoPrueba
}

export function BienvenidaRegistro({ clinicSlug, consumo }: Props) {
  const porcentaje = Math.min(
    100,
    Math.round((consumo.consumidas / Math.max(1, consumo.limite)) * 100)
  )

  return (
    <section
      aria-label="Bienvenida"
      className="flex flex-col gap-4 rounded-2xl border border-[#00a896]/30 bg-[#00a896]/10 p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#028090] shadow-sm">
          <PartyPopper className="size-5" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-bold tracking-tight text-[#028090]">
            ¡Tu cuenta está activa!
          </h2>
          <p className="text-sm leading-6 text-zinc-700">
            Comparte este enlace con tus pacientes para que reserven solos. Ya
            puedes configurar tus horarios, servicios y Pago Móvil.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#00a896]/25 bg-white px-3.5 py-3">
        <Link2 className="size-4 shrink-0 text-[#028090]" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] font-medium">
          {enlacePublico(clinicSlug)}
        </span>
        <Link
          href={`/${clinicSlug}`}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#028090] hover:underline"
        >
          Ver mi página
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      {/* Consumo de la prueba gratuita */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-zinc-700">
          <span>
            Prueba gratis: {consumo.consumidas} de {consumo.limite} reservas
            incluidas
          </span>
          <span className="text-[#028090]">
            {consumo.agotada
              ? "Prueba completada"
              : `Quedan ${consumo.restantes}`}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={consumo.limite}
          aria-valuenow={consumo.consumidas}
          aria-label="Reservas consumidas de la prueba gratuita"
          className="h-2 w-full overflow-hidden rounded-full bg-white"
        >
          <span
            className="block h-full rounded-full bg-linear-to-r from-[#00a896] to-[#028090]"
            style={{ width: `${porcentaje}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/${clinicSlug}/admin/configuracion`}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-linear-to-r from-[#00a896] to-[#028090] px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
        >
          <Wallet className="size-4" aria-hidden="true" />
          Configurar Pago Móvil
        </Link>
        <Link
          href={`/${clinicSlug}/admin/especialistas`}
          className="inline-flex h-10 items-center rounded-xl border border-[#00a896]/30 bg-white px-4 text-sm font-semibold text-[#028090] transition hover:bg-white/70"
        >
          Ajustar especialistas y horarios
        </Link>
      </div>
    </section>
  )
}
