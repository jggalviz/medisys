"use client"

/** Botón de cierre de sesión del Super Admin. */
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { useTransition } from "react"

import { signOutSuperAdmin } from "@/app/actions/super-admin"
import { Button } from "@/components/ui/button"

export function SuperAdminLogoutButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await signOutSuperAdmin()
          router.push("/login")
          router.refresh()
        })
      }
    >
      <LogOut className="size-4" />
      Cerrar sesión
    </Button>
  )
}
