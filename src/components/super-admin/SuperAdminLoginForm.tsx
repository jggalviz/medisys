"use client"

/** Login exclusivo del Super Admin (email + contraseña, rol requerido). */
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, ShieldAlert } from "lucide-react"

import { signInSuperAdmin } from "@/app/actions/super-admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SuperAdminLoginForm({ next = "/super-admin/dashboard" }: { next?: string }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function enviar(event: React.FormEvent) {
    event.preventDefault()
    if (isPending) return
    setError(null)
    startTransition(async () => {
      const resultado = await signInSuperAdmin(email, password)
      if (resultado.ok) {
        router.push(next.startsWith("/super-admin") ? next : "/super-admin/dashboard")
        router.refresh()
        return
      }
      setError(resultado.message)
    })
  }

  return (
    <form
      onSubmit={enviar}
      className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm"
    >
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-lg font-bold tracking-tight">Super Admin · Medisys</h1>
        <p className="text-sm text-muted-foreground">
          Acceso restringido al equipo de Medisys.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sa-email">Correo</Label>
        <Input
          id="sa-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sa-password">Contraseña</Label>
        <Input
          id="sa-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
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

      <Button type="submit" disabled={isPending} className="h-11 gap-2">
        {isPending && <LoaderCircle className="size-4 animate-spin" />}
        {isPending ? "Verificando…" : "Entrar al Super Admin"}
      </Button>
    </form>
  )
}
