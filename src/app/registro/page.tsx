import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  ReceiptText,
  ShieldCheck,
  Wallet,
} from "lucide-react"

import { AuthModeTabs, type AuthModo } from "@/components/auth/AuthModeTabs"
import { RegisterForm } from "@/components/auth/RegisterForm"
import { ClinicLoginForm } from "@/components/auth/ClinicLoginForm"
import { Brand } from "@/components/landing/Brand"
import { MENSAJE_PRUEBA_GRATIS } from "@/lib/trial"

/**
 * MEDISYS · Registro público de consultorios (`/registro`).
 *
 * Une en una sola pantalla el alta de la cuenta ("Crear cuenta") y el acceso al
 * panel ("Iniciar sesión"), con el mismo lenguaje visual de la landing
 * (verde institucional `#00a896` / `#028090`, fondo limpio y tipografía Plus
 * Jakarta Sans heredada del layout raíz).
 *
 * El modo viaja en `?modo=login` para que el cambio de pestaña sea un enlace
 * real (compartible y funcional sin JavaScript).
 */

export const metadata: Metadata = {
  title: "Crear cuenta gratis | Medisys",
  description:
    "Registra tu consultorio o clínica en minutos: agenda online 24/7, expedientes y facturación fiscal. Prueba gratis con tus primeras 10 reservas incluidas.",
  alternates: { canonical: "/registro" },
}

type RegistroPageProps = {
  searchParams: Promise<{ modo?: string }>
}

/** Beneficios mostrados junto al formulario (misma promesa que la landing). */
const BENEFICIOS = [
  {
    icono: <CalendarCheck className="size-4" aria-hidden="true" />,
    texto: "Enlace propio de reservas para tus pacientes, abierto 24/7.",
  },
  {
    icono: <Wallet className="size-4" aria-hidden="true" />,
    texto: "Pago Móvil verificado contra la tasa oficial del BCV.",
  },
  {
    icono: <ReceiptText className="size-4" aria-hidden="true" />,
    texto: "Expedientes, facturación fiscal y cierre de caja incluidos.",
  },
  {
    icono: <ShieldCheck className="size-4" aria-hidden="true" />,
    texto: "Sin tarjeta ni pagos por adelantado para comenzar.",
  },
] as const

export default async function RegistroPage({ searchParams }: RegistroPageProps) {
  const { modo } = await searchParams
  const esLogin = modo === "login"
  const modoActual: AuthModo = esLogin ? "login" : "registro"

  return (
    <main className="min-h-dvh bg-linear-to-b from-[#f2fbf9] via-white to-white">
      <div className="mx-auto grid w-full max-w-6xl items-start gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-16 lg:py-16">
        {/* Promesa de valor */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" aria-label="Medisys, inicio" className="shrink-0">
              <Brand />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Volver al inicio
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#00a896]/30 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#028090] shadow-sm">
              <Check className="size-3.5" aria-hidden="true" />
              {MENSAJE_PRUEBA_GRATIS}
            </span>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-zinc-900 sm:text-4xl">
              {esLogin ? (
                <>
                  Bienvenido de vuelta a{" "}
                  <span className="text-[#028090]">tu panel</span>
                </>
              ) : (
                <>
                  Tu consultorio con agenda online,{" "}
                  <span className="text-[#028090]">listo en minutos</span>
                </>
              )}
            </h1>
            <p className="max-w-xl text-base leading-7 text-zinc-600">
              {esLogin
                ? "Entra con el correo de tu cuenta y te llevamos directo al panel de tu consultorio o clínica."
                : "Crea tu cuenta, comparte el enlace de reservas y deja que tus pacientes agenden solos. Tus primeras 10 reservas van por nuestra cuenta: sin tarjeta, sin mensualidad y sin compromiso."}
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            {BENEFICIOS.map((beneficio) => (
              <li key={beneficio.texto} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#00a896]/10 text-[#028090]">
                  {beneficio.icono}
                </span>
                <span className="text-sm leading-6 text-zinc-700">
                  {beneficio.texto}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Formulario */}
        <section className="flex w-full flex-col items-center gap-4 lg:sticky lg:top-10">
          <AuthModeTabs modo={modoActual} />
          {esLogin ? <ClinicLoginForm /> : <RegisterForm />}
        </section>
      </div>
    </main>
  )
}
