"use client"

/**
 * MEDISYS · Inicio de sesión del personal desde la pantalla de acceso (`/registro`).
 *
 * A diferencia del login por clínica (`/[clinicSlug]/login`), aquí el usuario no
 * necesita conocer el slug de su consultorio: `signInStaffGlobal` resuelve el
 * panel a partir de las membresías del usuario y la UI redirige a él.
 */
import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LoaderCircle, Lock, Mail, ShieldAlert } from "lucide-react"

import { signInStaffGlobal } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ClinicLoginForm() {
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
      const resultado = await signInStaffGlobal({ email, password })
      if (!resultado.ok) {
        setError(resultado.message)
        return
      }
      router.push(`/${resultado.slug}/admin`)
      router.refresh()
    })
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-md flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold tracking-tight">
          Inicia sesión en tu panel
        </h2>
        <p className="text-sm text-muted-foreground">
          Escribe el correo con el que creaste tu cuenta y te llevamos al panel
          de tu consultorio.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="acc-email">Correo electrónico</Label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="acc-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="recepcion@tuconsultorio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-9"
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="acc-password">Contraseña</Label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="acc-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-9"
            required
          />
        </div>
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
        {isPending && (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        )}
        {isPending ? "Verificando acceso…" : "Entrar a mi panel"}
      </Button>

      <p className="flex flex-wrap items-center justify-center gap-1 text-sm text-muted-foreground">
        ¿Todavía no tienes cuenta?
        <Link
          href="/registro"
          scroll={false}
          className="font-semibold text-[#028090] hover:underline"
        >
          Crear cuenta gratis
        </Link>
      </p>
    </form>
  )
}
