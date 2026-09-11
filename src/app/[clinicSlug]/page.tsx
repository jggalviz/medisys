import { notFound } from "next/navigation"
import type { CSSProperties } from "react"
import type { Metadata } from "next"
import {
  AtSign,
  BadgeCheck,
  CalendarCheck,
  Clock,
  CreditCard,
  Globe,
  GraduationCap,
  IdCard,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react"

import { getTenantBySlug } from "@/app/actions/tenant"
import { getDoctorsByTenant } from "@/app/actions/booking"
import type { LandingConfig } from "@/types/database"
import { inicialesTenant, imagenMostrable, logoMostrable } from "@/lib/branding"
import { doctorNombre, formatUSD, iniciales } from "@/lib/format"
import {
  landingHabilitada,
  normalizarLandingConfig,
  urlRedSocial,
} from "@/lib/landing"
import { normalizarThemeConfig, temaCssVars } from "@/lib/theme"

/**
 * Landing Page / Perfil Profesional del tenant: /[clinicSlug].
 * Lee la configuración (`landing_config`) y el switch (`landing_enabled`) en
 * cada petición, además de los especialistas activos de la tabla `doctors`.
 */
export const dynamic = "force-dynamic"

/** Sin caché de ruta: siempre lee el estado fresco de `tenants`/`doctors`. */
export const revalidate = 0

type ClinicLandingProps = {
  params: Promise<{ clinicSlug: string }>
}

export async function generateMetadata({
  params,
}: ClinicLandingProps): Promise<Metadata> {
  const { clinicSlug } = await params
  const tenant = await getTenantBySlug(clinicSlug)

  if (!tenant) {
    return { title: "Clínica no encontrada | Medisys", robots: { index: false } }
  }

  const config = normalizarLandingConfig(tenant.landing_config)
  const titulo = config.hero_titulo ?? tenant.nombre
  const descripcion =
    config.hero_subtitulo ??
    `Agenda tu cita médica en ${tenant.nombre} de forma rápida y segura.`
  // Nunca compartir logos obsoletos (p. ej. "Santa Inés") en el Open Graph.
  const logo = logoMostrable(tenant.logo_url)

  return {
    title: `${titulo} | ${tenant.nombre}`,
    description: descripcion,
    openGraph: {
      title: `${titulo} | ${tenant.nombre}`,
      description: descripcion,
      ...(logo ? { images: [logo] } : {}),
    },
  }
}

export default async function ClinicLandingPage({ params }: ClinicLandingProps) {
  const { clinicSlug } = await params
  const tenant = await getTenantBySlug(clinicSlug)
  if (!tenant) notFound()

  // Switch público: landing desactivada → pantalla de mantenimiento amigable.
  if (!landingHabilitada(tenant)) {
    return (
      <Mantenimiento
        nombre={tenant.nombre}
        clinicSlug={clinicSlug}
        telefono={tenant.telefono ?? null}
      />
    )
  }

  const config = normalizarLandingConfig(tenant.landing_config)
  const logo = logoMostrable(tenant.logo_url)
  // Tema/apariencia configurada por la clínica (con defaults neutros).
  const tema = normalizarThemeConfig(tenant.theme_config)
  const estiloTema = {
    ...temaCssVars(tema),
    backgroundColor: tema.backgroundColor,
  } as CSSProperties
  const resultado = await getDoctorsByTenant(clinicSlug)
  const doctores = resultado.ok ? [...resultado.data] : []

  const especialidades = Array.from(
    new Set(
      doctores
        .flatMap((doctor) => [doctor.especialidad, ...(doctor.especialidades ?? [])])
        .map((e) => e?.trim())
        .filter((e): e is string => Boolean(e))
    )
  ).slice(0, 8)

  const reservarHref = `/${clinicSlug}/reservar`
  const instagram = urlRedSocial(config.instagram, "instagram")
  const facebook = urlRedSocial(config.facebook, "facebook")

  return (
    <main className="min-h-dvh" style={estiloTema}>
      <header
        className="border-b"
        style={{ backgroundColor: tema.cardBackgroundColor }}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo del tenant (Storage externo)
              <img
                src={logo}
                alt={`Logo de ${tenant.nombre}`}
                className="size-20 shrink-0 rounded-3xl border bg-background object-cover shadow-sm"
              />
            ) : (
              <span
                aria-label={`Marca de ${tenant.nombre}`}
                className="flex size-20 shrink-0 items-center justify-center rounded-3xl border bg-primary/10 text-2xl font-bold text-primary shadow-sm"
              >
                {inicialesTenant(tenant.nombre)}
              </span>
            )}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold uppercase tracking-wide text-primary">
                {tenant.nombre}
              </span>
              <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                {config.hero_titulo ?? `Bienvenido a ${tenant.nombre}`}
              </h1>
              {config.hero_subtitulo && (
                <p className="max-w-2xl text-base text-muted-foreground">
                  {config.hero_subtitulo}
                </p>
              )}
              <Autoridad config={config} />
            </div>
          </div>

          {especialidades.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {especialidades.map((esp) => (
                <li
                  key={esp}
                  className="rounded-full border border-transparent px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: tema.secondaryColor,
                    color: tema.primaryColor,
                  }}
                >
                  {esp}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={reservarHref}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold transition-opacity hover:opacity-90"
              style={{
                backgroundColor: tema.primaryColor,
                color: tema.buttonTextColor,
              }}
            >
              <CalendarCheck className="size-5" />
              Reservar Cita
            </a>
            {tenant.telefono && (
              <a
                href={`tel:${tenant.telefono.replace(/\s+/g, "")}`}
                className="inline-flex h-12 items-center gap-2 rounded-xl border bg-background px-5 text-sm font-medium transition-colors hover:bg-muted/50"
              >
                <Phone className="size-4" />
                {tenant.telefono}
              </a>
            )}
            {(instagram || facebook) && (
              <div className="flex flex-wrap items-center gap-2">
                {instagram && (
                  <a
                    href={instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-full border bg-background px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <AtSign className="size-4" />
                    Instagram
                  </a>
                )}
                {facebook && (
                  <a
                    href={facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-full border bg-background px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Globe className="size-4" />
                    Facebook
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
        {/* Sobre mí */}
        {(config.sobre_nosotros || config.subespecialidades) && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold tracking-tight">Sobre mí</h2>
            {config.subespecialidades && (
              <p
                className="flex items-center gap-2 text-sm font-medium"
                style={{ color: tema.primaryColor }}
              >
                <Stethoscope className="size-4" />
                {config.subespecialidades}
              </p>
            )}
            {config.sobre_nosotros && (
              <p className="whitespace-pre-line text-base leading-relaxed text-muted-foreground">
                {config.sobre_nosotros}
              </p>
            )}
          </section>
        )}

        {/* Servicios y horarios */}
        {(config.servicios.length > 0 || config.horarios) && (
          <section className="grid gap-4 lg:grid-cols-3">
            {config.servicios.length > 0 && (
              <div className="flex flex-col gap-4 lg:col-span-2">
                <h2 className="text-xl font-bold tracking-tight">
                  Servicios y tratamientos
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {config.servicios.map((servicio) => (
                    <li
                      key={servicio.titulo}
                      className="flex flex-col gap-1 rounded-2xl border p-4"
                      style={{ backgroundColor: tema.cardBackgroundColor }}
                    >
                      <span className="flex items-center gap-2 font-semibold">
                        <Stethoscope
                          className="size-4"
                          style={{ color: tema.primaryColor }}
                        />
                        {servicio.titulo}
                      </span>
                      {servicio.descripcion && (
                        <span className="text-sm text-muted-foreground">
                          {servicio.descripcion}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {config.horarios && (
              <aside
                className="flex flex-col gap-3 rounded-2xl border p-5"
                style={{ backgroundColor: tema.cardBackgroundColor }}
              >
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <Clock className="size-4" style={{ color: tema.primaryColor }} />
                  Horarios de atención
                </h3>
                <p className="whitespace-pre-line text-sm leading-relaxed">
                  {config.horarios}
                </p>
                <dl className="mt-1 flex flex-col gap-2.5 border-t pt-3 text-sm">
                  {(config.direccion_detallada || tenant.direccion) && (
                    <div className="flex items-start gap-2">
                      <MapPin
                        className="mt-0.5 size-4 shrink-0"
                        style={{ color: tema.primaryColor }}
                      />
                      <span>
                        {config.direccion_detallada ?? tenant.direccion}
                      </span>
                    </div>
                  )}
                  {config.punto_referencia && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-primary/60" />
                      <span className="italic">{config.punto_referencia}</span>
                    </div>
                  )}
                  {tenant.telefono && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="size-4 shrink-0 text-primary" />
                      <span>{tenant.telefono}</span>
                    </div>
                  )}
                  {config.metodos_pago.length > 0 && (
                    <div className="flex flex-col gap-1.5 pt-1">
                      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <CreditCard className="size-3.5 text-primary" />
                        Métodos de pago
                      </dt>
                      <dd className="flex flex-wrap gap-1.5">
                        {config.metodos_pago.map((metodo) => (
                          <span
                            key={metodo}
                            className="rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                          >
                            {metodo}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              </aside>
            )}
          </section>
        )}

        {/* Especialistas */}
        {doctores.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-bold tracking-tight">Nuestro equipo médico</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {doctores.map((doctor) => (
                <li
                  key={doctor.id}
                  className="flex flex-col gap-3 rounded-2xl border p-5"
                  style={{ backgroundColor: tema.cardBackgroundColor }}
                >
                  {imagenMostrable(doctor.foto_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- foto del especialista (Storage externo)
                    <img
                      src={imagenMostrable(doctor.foto_url) as string}
                      alt={doctorNombre(doctor)}
                      className="size-14 rounded-2xl border object-cover"
                    />
                  ) : (
                    <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-base font-bold text-primary">
                      {iniciales(doctor.nombres, doctor.apellidos)}
                    </span>
                  )}
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">{doctorNombre(doctor)}</span>
                    <span className="text-sm text-muted-foreground">
                      {doctor.especialidad}
                    </span>
                    {doctor.precio_consulta > 0 && (
                      <span
                        className="text-sm font-semibold"
                        style={{ color: tema.primaryColor }}
                      >
                        {formatUSD(doctor.precio_consulta)}
                      </span>
                    )}
                  </div>
                  <a
                    href={reservarHref}
                    className="mt-auto inline-flex h-10 items-center justify-center rounded-xl border text-sm font-medium transition-colors hover:bg-muted/50"
                    style={{ color: tema.primaryColor }}
                  >
                    Reservar con este especialista
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Preguntas frecuentes */}
        {config.faq.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold tracking-tight">
              Preguntas frecuentes
            </h2>
            <div className="flex flex-col gap-2">
              {config.faq.map((item) => (
                <details
                  key={item.pregunta}
                  className="group rounded-2xl border px-4 py-3"
                  style={{ backgroundColor: tema.cardBackgroundColor }}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
                    {item.pregunta}
                    <span
                      aria-hidden="true"
                      className="text-lg leading-none transition-transform group-open:rotate-45"
                      style={{ color: tema.primaryColor }}
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {item.respuesta}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* CTA final */}
        <section
          className="flex flex-col items-center gap-4 rounded-3xl border px-6 py-10 text-center"
          style={{ backgroundColor: tema.secondaryColor }}
        >
          <h2
            className="text-2xl font-bold tracking-tight"
            style={{ color: tema.primaryColor }}
          >
            Agenda tu cita en minutos
          </h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Elige tu especialista, el turno que prefieras y paga con Pago Móvil o
            en recepción. Recibirás la confirmación de {tenant.nombre}.
          </p>
          <a
            href={reservarHref}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-8 text-base font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: tema.primaryColor,
              color: tema.buttonTextColor,
            }}
          >
            <CalendarCheck className="size-5" />
            Reservar Cita
          </a>
        </section>

      </div>

    </main>
  )
}

/** Pantalla de mantenimiento cuando `landing_enabled === false`. */
function Mantenimiento({
  nombre,
  clinicSlug,
  telefono,
}: {
  nombre: string
  clinicSlug: string
  telefono: string | null
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border bg-card p-8 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
          <Clock className="size-6" />
        </span>
        <h1 className="text-xl font-bold tracking-tight">
          Perfil temporalmente inactivo
        </h1>
        <p className="text-sm text-muted-foreground">
          La página pública de <strong>{nombre}</strong> no está disponible en
          este momento. Puedes agendar tu cita directamente o contactarnos.
        </p>
        <a
          href={`/${clinicSlug}/reservar`}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <CalendarCheck className="size-4" />
          Ir al agendamiento
        </a>
        {telefono && (
          <a
            href={`tel:${telefono.replace(/\s+/g, "")}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Phone className="size-4" />
            {telefono}
          </a>
        )}
      </div>
    </main>
  )
}

/** Fila de autoridad médica + badges del Hero (universidad, MPPS, colegio). */
function Autoridad({ config }: { config: LandingConfig }) {
  const hayDatos = Boolean(
    config.universidad || config.mpps || config.colegio_medico
  )
  const hayBadges = config.badges.emergencias || config.badges.telemedicina
  if (!hayDatos && !hayBadges) return null

  return (
    <div className="flex flex-col gap-2.5">
      {hayDatos && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {config.universidad && (
            <li className="inline-flex items-center gap-1.5">
              <GraduationCap className="size-3.5 text-primary" />
              {config.universidad}
            </li>
          )}
          {config.mpps && (
            <li className="inline-flex items-center gap-1.5">
              <IdCard className="size-3.5 text-primary" />
              MPPS: {config.mpps}
            </li>
          )}
          {config.colegio_medico && (
            <li className="inline-flex items-center gap-1.5">
              <BadgeCheck className="size-3.5 text-primary" />
              Colegio Médico: {config.colegio_medico}
            </li>
          )}
        </ul>
      )}

      {hayBadges && (
        <div className="flex flex-wrap gap-2">
          {config.badges.emergencias && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="size-3.5" />
              Atención de emergencias
            </span>
          )}
          {config.badges.telemedicina && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-400">
              <Sparkles className="size-3.5" />
              Telemedicina / consulta online
            </span>
          )}
        </div>
      )}
    </div>
  )
}


