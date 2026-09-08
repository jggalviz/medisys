"use client"

/**
 * Formulario de inicio de sesión del personal multi-tenant.
 * Llama a la Server Action `signInStaff` (email/contraseña + membresía).
 */
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, LoaderCircle, Lock, Mail, ShieldAlert } from "lucide-react"

import { signInStaff } from "@/app/actions/auth"
import { DEMO_CREDENCIALES } from "@/lib/demo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = {
  clinicSlug: string
  tenantNombre: string
  tenantLogoUrl?: string | null
  /** Muestra el callout con credenciales y autocompletado de la demo. */
  esDemo?: boolean
}

export function LoginForm({
  clinicSlug,
  tenantNombre,
  tenantLogoUrl,
  esDemo = false,
}: Props) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isPending) return
    setError(null)

    startTransition(async () => {
      const result = await signInStaff({
        clinicSlug,
        email,
        password,
      })

      if (result.ok) {
        router.push(`/${clinicSlug}/admin`)
        router.refresh()
        return
      }
      setError(result.message)
    })
  }

  function rellenarDemo() {
    if (isPending) return
    setError(null)
    setEmail(DEMO_CREDENCIALES.email)
    setPassword(DEMO_CREDENCIALES.password)
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm"
    >
      <div className="flex flex-col items-center gap-1 text-center">
        {!esDemo &&
          (tenantLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Logo dinámico del tenant (Supabase Storage)
            <img
              src={tenantLogoUrl}
              alt={`Logo de ${tenantNombre}`}
              className="size-12 rounded-full object-cover"
            />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lock className="size-5" aria-hidden="true" />
            </span>
          ))}
        <h1 className="text-lg font-bold tracking-tight">
          Panel de {tenantNombre}
        </h1>
        <p className="text-sm text-muted-foreground">
          Inicia sesión con tu correo del personal.
        </p>
      </div>

      {esDemo && (
        <div
          role="note"
          className="flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50/80 p-3.5 text-sky-900 dark:border-sky-400/25 dark:bg-sky-950/40 dark:text-sky-100"
        >
          <div className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sky-600/10 text-sky-700 dark:text-sky-300">
              <KeyRound className="size-4" aria-hidden="true" />
            </span>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wide text-sky-700/90 dark:text-sky-300/90">
                Cuenta de demostración
              </span>
              <span className="text-xs text-sky-700/80 dark:text-sky-200/70">
                Credenciales listas para probar el panel
              </span>
            </div>
          </div>

          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-sky-700/80 dark:text-sky-200/70">Correo</dt>
              <dd className="truncate font-mono font-semibold">
                {DEMO_CREDENCIALES.email}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-sky-700/80 dark:text-sky-200/70">
                Contraseña
              </dt>
              <dd className="font-mono font-semibold">
                {DEMO_CREDENCIALES.password}
              </dd>
            </div>
          </dl>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={rellenarDemo}
            className="gap-2"
          >
            <KeyRound className="size-3.5" aria-hidden="true" />
            Rellenar datos demo
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-email">Correo electrónico</Label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder={
              esDemo ? DEMO_CREDENCIALES.email : "recepcion@clinica.com"
            }
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-password">Contraseña</Label>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="h-12 gap-2 text-base">
        {isPending && <LoaderCircle className="size-4 animate-spin" />}
        {isPending ? "Verificando acceso…" : "Entrar al panel"}
      </Button>
    </form>
  )
}
