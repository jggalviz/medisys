"use client"

/**
 * MEDISYS · Formulario de registro público de consultorios (`/registro`).
 *
 *  - Validación en tiempo real campo por campo (misma reglas que el servidor,
 *    vía `@/lib/validations/registro`).
 *  - Verificación con debounce de la disponibilidad del enlace público.
 *  - Estado de carga en el botón y errores de API con mensajes del servidor
 *    ("El correo ya está registrado", "El nombre de consultorio no está
 *    disponible").
 *  - Al crear la cuenta inicia sesión automáticamente y redirige al panel de
 *    bienvenida (`/[slug]/admin?bienvenida=1`).
 */
import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  CircleCheck,
  LoaderCircle,
  Lock,
  Mail,
  Phone,
  ShieldAlert,
  Stethoscope,
  User,
} from "lucide-react"

import { registrarConsultorio, verificarConsultorio } from "@/app/actions/registro"
import { ESPECIALIDADES_MEDICAS, ESPECIALIDAD_OTRA } from "@/lib/especialidades"
import { PREFIJO_POR_DEFECTO, PREFIJOS_PAIS } from "@/lib/telefono"
import {
  MENSAJE_PRUEBA_TODOS_PLANES,
  PLAN_REGISTRO_POR_DEFECTO,
} from "@/lib/trial"
import { nombrePlan } from "@/lib/suscripcion"
import { enlacePublico, URL_SITIO_PUBLICO } from "@/lib/site"
import type { PlanTenant } from "@/types/database"
import {
  CAMPOS_REGISTRO,
  slugDesdeConsultorio,
  validarCampoRegistro,
  type RegistroCampo,
} from "@/lib/validations/registro"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlanSelector } from "@/components/auth/PlanSelector"
import { cn } from "@/lib/utils"

/**
 * Paleta institucional del registro: verde Medisys `#00a896` y su tono oscuro
 * `#028090` (mismos valores que usan los CTA del formulario en las clases
 * arbitrarias de Tailwind `from-[#00a896]`, `text-[#028090]`).
 */

type ValoresForm = {
  /** Plan comercial elegido en el selector de tarjetas. */
  plan: PlanTenant
  nombre: string
  email: string
  prefijo: string
  telefono: string
  consultorio: string
  especialidad: string
  especialidadOtra: string
  password: string
  confirmarPassword: string
}

const VALORES_INICIALES: ValoresForm = {
  plan: PLAN_REGISTRO_POR_DEFECTO,
  nombre: "",
  email: "",
  prefijo: PREFIJO_POR_DEFECTO,
  telefono: "",
  consultorio: "",
  especialidad: "medicina-general",
  especialidadOtra: "",
  password: "",
  confirmarPassword: "",
}

type EstadoEnlace = {
  /** Slug verificado (el que coincide con el nombre ya consultado). */
  slug: string
  /** `true` libre, `false` en uso, `null` no verificado. */
  disponible: boolean | null
}

/** Mensaje de error de un campo. */
function MensajeError({ children }: { children?: string | null }) {
  if (!children) return null
  return (
    <p className="flex items-start gap-1.5 text-xs font-medium text-destructive">
      <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  )
}

/** Pista neutra bajo un campo (ayuda contextual). */
function Ayuda({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}

function valorDeCampo(valores: ValoresForm, campo: RegistroCampo): string {
  switch (campo) {
    case "plan":
      return valores.plan
    case "nombre":
      return valores.nombre
    case "email":
      return valores.email
    case "telefono":
      return valores.telefono
    case "consultorio":
      return valores.consultorio
    case "especialidad":
      return valores.especialidad
    case "password":
      return valores.password
    case "confirmarPassword":
      return valores.confirmarPassword
    default:
      return ""
  }
}

export function RegisterForm() {
  const router = useRouter()
  const [valores, setValores] = useState<ValoresForm>(VALORES_INICIALES)
  const [tocados, setTocados] = useState<
    Partial<Record<RegistroCampo, boolean>>
  >({})
  const [erroresServidor, setErroresServidor] = useState<
    Partial<Record<RegistroCampo, string>>
  >({})
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<{
    slug: string
    consultorio: string
    plan: PlanTenant
    cupoEspecialistas: number
  } | null>(null)
  const [enlace, setEnlace] = useState<EstadoEnlace>({
    slug: "",
    disponible: null,
  })
  const [isPending, startTransition] = useTransition()

  /** Errores visibles: primero los del servidor, después la validación local. */
  const errores = useMemo(() => {
    const mapa: Partial<Record<RegistroCampo, string>> = {}
    for (const campo of CAMPOS_REGISTRO) {
      const delServidor = erroresServidor[campo]
      if (delServidor) {
        mapa[campo] = delServidor
        continue
      }
      if (!tocados[campo]) continue
      const mensaje = validarCampoRegistro(campo, valorDeCampo(valores, campo), {
        password: valores.password,
        prefijo: valores.prefijo,
        especialidadOtra: valores.especialidadOtra,
      })
      if (mensaje) mapa[campo] = mensaje
    }
    return mapa
  }, [valores, tocados, erroresServidor])

  const hayErrores = Object.keys(errores).length > 0

  // Disponibilidad del enlace público (`medisys.com.ve/tu-consultorio`).
  // El estado solo se escribe en el callback del temporizador (asíncrono); el
  // indicador de "verificando…" se deriva comparando el slug verificado con el
  // que genera el nombre actual.
  useEffect(() => {
    const nombre = valores.consultorio.trim()
    if (slugDesdeConsultorio(nombre).length < 3) return

    let cancelado = false
    const temporizador = setTimeout(async () => {
      const resultado = await verificarConsultorio(nombre)
      if (cancelado) return
      setEnlace(
        resultado.ok
          ? {
              slug: resultado.data.slug,
              disponible: resultado.data.disponible,
            }
          : {
              slug: slugDesdeConsultorio(nombre),
              disponible: null,
            }
      )
    }, 450)

    return () => {
      cancelado = true
      clearTimeout(temporizador)
    }
  }, [valores.consultorio])

  function actualizar(campo: RegistroCampo, valor: string) {
    setValores((prev) => {
      if (campo === "especialidad") return { ...prev, especialidad: valor }
      if (campo === "nombre") return { ...prev, nombre: valor }
      if (campo === "email") return { ...prev, email: valor }
      if (campo === "telefono") return { ...prev, telefono: valor }
      if (campo === "consultorio") return { ...prev, consultorio: valor }
      if (campo === "password") return { ...prev, password: valor }
      return { ...prev, confirmarPassword: valor }
    })
    setTocados((prev) => (prev[campo] ? prev : { ...prev, [campo]: true }))
    setErroresServidor((prev) => {
      if (!prev[campo]) return prev
      const copia = { ...prev }
      delete copia[campo]
      return copia
    })
    setError(null)
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isPending) return
    setError(null)
    setErroresServidor({})
    setTocados(
      CAMPOS_REGISTRO.reduce<Partial<Record<RegistroCampo, boolean>>>(
        (acc, campo) => ({ ...acc, [campo]: true }),
        {}
      )
    )

    if (hayErrores) {
      setError("Revisa los campos marcados en rojo antes de continuar.")
      return
    }

    startTransition(async () => {
      const resultado = await registrarConsultorio(valores)

      if (!resultado.ok) {
        setError(resultado.message)
        if (resultado.errores) setErroresServidor(resultado.errores)
        return
      }

      // Cuenta creada: si la sesión quedó iniciada entramos directo al panel.
      if (resultado.sesionIniciada) {
        router.push(`/${resultado.slug}/admin?bienvenida=1`)
        router.refresh()
        return
      }

      setExito({
        slug: resultado.slug,
        consultorio: resultado.consultorio,
        plan: resultado.plan,
        cupoEspecialistas: resultado.cupoEspecialistas,
      })
    })
  }

  /** Selección de plan (radio-cards): no pasa por la validación de texto. */
  function actualizarPlan(plan: PlanTenant) {
    setValores((prev) => ({ ...prev, plan }))
    setTocados((prev) => ({ ...prev, plan: true }))
    setErroresServidor((prev) => {
      if (!prev.plan) return prev
      const copia = { ...prev }
      delete copia.plan
      return copia
    })
    setError(null)
  }

  function actualizarEspecialidadOtra(valor: string) {
    setValores((prev) => ({ ...prev, especialidadOtra: valor }))
    setTocados((prev) => ({ ...prev, especialidad: true }))
    setErroresServidor((prev) => {
      if (!prev.especialidad) return prev
      const copia = { ...prev }
      delete copia.especialidad
      return copia
    })
    setError(null)
  }

  const slugBase = slugDesdeConsultorio(valores.consultorio)
  /** Verificación del enlace en curso (nombre distinto al último verificado). */
  const verificandoEnlace =
    slugBase.length >= 3 && enlace.slug !== slugBase
  /** Disponibilidad correspondiente al nombre actual (o `null`). */
  const enlaceDisponible = enlace.slug === slugBase ? enlace.disponible : null
  const enlaceMostrado = slugBase
    ? `${URL_SITIO_PUBLICO}/${slugBase}`
    : `${URL_SITIO_PUBLICO}/tu-consultorio`

  /* --------------------------- Cuenta creada --------------------------- */
  if (exito) {
    return (
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#00a896]/10 text-[#028090]">
            <CircleCheck className="size-6" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-bold tracking-tight">
            ¡Cuenta creada con éxito!
          </h2>
          <p className="text-sm text-muted-foreground">
            {exito.consultorio} ya tiene su enlace público de reservas.
          </p>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border border-[#00a896]/25 bg-[#00a896]/10 px-3.5 py-3 text-sm">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#028090]">
            Enlace de reservas
          </span>
          <span className="truncate font-mono text-[13px] font-medium">
            {enlacePublico(exito.slug)}
          </span>
        </div>

        <dl className="flex flex-col gap-1 rounded-xl border bg-muted/40 px-3.5 py-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Plan activado</dt>
            <dd className="font-semibold">{nombrePlan(exito.plan)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Especialistas incluidos</dt>
            <dd className="font-semibold">{exito.cupoEspecialistas}</dd>
          </div>
        </dl>

        <p className="text-sm text-muted-foreground">
          Inicia sesión con el correo y la contraseña que acabas de registrar
          para entrar a tu panel.
        </p>

        <Button
          render={<Link href={`/${exito.slug}/login`} />}
          nativeButton={false}
          className="h-12 gap-2 bg-linear-to-r from-[#00a896] to-[#028090] text-base text-white hover:opacity-95"
        >
          Ir al panel de mi consultorio
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    )
  }

  /* ---------------------------- Formulario ---------------------------- */
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex w-full max-w-md flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm"
    >
      <div className="flex items-start gap-2 rounded-xl border border-[#00a896]/25 bg-[#00a896]/10 px-3.5 py-3">
        <span aria-hidden="true" className="text-base leading-none">
          🎁
        </span>
        <p className="text-[13px] font-semibold leading-5 text-[#028090]">
          {MENSAJE_PRUEBA_TODOS_PLANES}
        </p>
      </div>

      {/* 0. Plan comercial (radio-cards con explicación accesible) */}
      <PlanSelector
        valor={valores.plan}
        onChange={actualizarPlan}
        error={errores.plan}
      />

      {/* 1. Nombre y apellido */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reg-nombre">Nombre y apellido *</Label>
        <div className="relative">
          <User
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="reg-nombre"
            name="nombre"
            autoComplete="name"
            placeholder="Dra. Ana Pérez"
            value={valores.nombre}
            onChange={(e) => actualizar("nombre", e.target.value)}
            aria-invalid={Boolean(errores.nombre) || undefined}
            className="pl-9"
            required
          />
        </div>
        <MensajeError>{errores.nombre}</MensajeError>
      </div>

      {/* 2. Correo electrónico */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reg-email">Correo electrónico *</Label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="reg-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="recepcion@tuconsultorio.com"
            value={valores.email}
            onChange={(e) => actualizar("email", e.target.value)}
            aria-invalid={Boolean(errores.email) || undefined}
            className="pl-9"
            required
          />
        </div>
        <MensajeError>{errores.email}</MensajeError>
        <Ayuda>Será tu usuario para entrar al panel.</Ayuda>
      </div>

      {/* 3. WhatsApp con prefijo de país */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reg-telefono">WhatsApp / teléfono *</Label>
        <div className="flex gap-2">
          <select
            aria-label="Prefijo de país"
            value={valores.prefijo}
            onChange={(e) =>
              setValores((prev) => ({ ...prev, prefijo: e.target.value }))
            }
            className="h-12 w-[8.25rem] shrink-0 rounded-xl border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {PREFIJOS_PAIS.map((pais) => (
              <option key={pais.codigo} value={pais.codigo}>
                {pais.bandera} +{pais.codigo}
              </option>
            ))}
          </select>
          <div className="relative flex-1">
            <Phone
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="reg-telefono"
              name="telefono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="4121234567"
              value={valores.telefono}
              onChange={(e) => actualizar("telefono", e.target.value)}
              aria-invalid={Boolean(errores.telefono) || undefined}
              className="pl-9"
              required
            />
          </div>
        </div>
        <MensajeError>{errores.telefono}</MensajeError>
        <Ayuda>Por aquí te avisamos de cada nueva reserva.</Ayuda>
      </div>

      {/* 4. Nombre del consultorio (genera el enlace de reservas) */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reg-consultorio">Nombre del consultorio o clínica *</Label>
        <div className="relative">
          <Building2
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="reg-consultorio"
            name="consultorio"
            autoComplete="organization"
            placeholder="Consultorio Dra. Ana Pérez"
            value={valores.consultorio}
            onChange={(e) => actualizar("consultorio", e.target.value)}
            aria-invalid={Boolean(errores.consultorio) || undefined}
            className="pl-9"
            required
          />
        </div>
        <MensajeError>{errores.consultorio}</MensajeError>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="text-muted-foreground">Tu enlace de reservas:</span>
          <span className="max-w-full truncate font-mono font-medium text-foreground">
            {enlaceMostrado}
          </span>
          {verificandoEnlace ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              Verificando…
            </span>
          ) : enlaceDisponible === true ? (
            <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
              <Check className="size-3.5" aria-hidden="true" />
              Disponible
            </span>
          ) : enlaceDisponible === false ? (
            <span className="font-medium text-amber-600">
              En uso · agregaremos un número para que sea único
            </span>
          ) : null}
        </div>
      </div>

      {/* 5. Especialidad médica */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reg-especialidad">Especialidad médica *</Label>
        <div className="relative">
          <Stethoscope
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <select
            id="reg-especialidad"
            name="especialidad"
            value={valores.especialidad}
            onChange={(e) => actualizar("especialidad", e.target.value)}
            aria-invalid={Boolean(errores.especialidad) || undefined}
            className={cn(
              "h-12 w-full appearance-none rounded-xl border border-input bg-background pl-9 pr-8 text-base shadow-xs outline-none",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              "aria-invalid:border-destructive aria-invalid:ring-destructive/20"
            )}
          >
            {ESPECIALIDADES_MEDICAS.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
            <option value={ESPECIALIDAD_OTRA}>Otra especialidad…</option>
          </select>
        </div>

        {valores.especialidad === ESPECIALIDAD_OTRA && (
          <Input
            aria-label="Escribe tu especialidad"
            placeholder="Ej. Medicina del Deporte"
            value={valores.especialidadOtra}
            onChange={(e) => actualizarEspecialidadOtra(e.target.value)}
            aria-invalid={Boolean(errores.especialidad) || undefined}
            maxLength={80}
          />
        )}
        <MensajeError>{errores.especialidad}</MensajeError>
        <Ayuda>
          Se usa para crear tu perfil de especialista en el enlace de reservas.
        </Ayuda>
      </div>

      {/* 6. Contraseña */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reg-password">Contraseña *</Label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="reg-password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            value={valores.password}
            onChange={(e) => actualizar("password", e.target.value)}
            aria-invalid={Boolean(errores.password) || undefined}
            className="pl-9"
            required
            minLength={8}
          />
        </div>
        <MensajeError>{errores.password}</MensajeError>
      </div>

      {/* 7. Confirmación de contraseña */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reg-password2">Confirmar contraseña *</Label>
        <Input
          id="reg-password2"
          name="confirmarPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Repite tu contraseña"
          value={valores.confirmarPassword}
          onChange={(e) => actualizar("confirmarPassword", e.target.value)}
          aria-invalid={Boolean(errores.confirmarPassword) || undefined}
          required
        />
        <MensajeError>{errores.confirmarPassword}</MensajeError>
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="h-12 gap-2 bg-linear-to-r from-[#00a896] to-[#028090] text-base font-semibold text-white shadow-md shadow-[#028090]/20 transition hover:brightness-105 disabled:opacity-70"
      >
        {isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        {isPending ? "Creando tu cuenta…" : "Crear mi cuenta gratis"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Sin tarjeta ni pagos por adelantado. Al crear la cuenta aceptas los
        términos del servicio.
      </p>

      <p className="flex flex-wrap items-center justify-center gap-1 text-sm text-muted-foreground">
        ¿Ya tienes cuenta?
        <Link
          href="/registro?modo=login"
          scroll={false}
          className="font-semibold text-[#028090] hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </form>
  )
}
