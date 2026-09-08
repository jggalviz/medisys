"use client"

/**
 * Formulario de inicio de sesión del personal multi-tenant.
 * Llama a la Server Action `signInStaff` (email/contraseña + membresía).
 */
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Lock, Mail, ShieldAlert } from "lucide-react"

import { signInStaff } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = {
  clinicSlug: string
  tenantNombre: string
  tenantLogoUrl?: string | null
}

export function LoginForm({
  clinicSlug,
  tenantNombre,
  tenantLogoUrl,
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

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        {tenantLogoUrl ? (
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
        )}
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            Panel de {tenantNombre}
          </h1>
          <p className="text-sm text-muted-foreground">
            Inicia sesión con tu correo del personal.
          </p>
        </div>
      </div>

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
            placeholder="recepcion@clinica.com"
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
