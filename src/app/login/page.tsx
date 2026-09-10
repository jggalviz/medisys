import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { SuperAdminLoginForm } from "@/components/super-admin/SuperAdminLoginForm"
import { getSuperAdmin } from "@/lib/super-admin"

export const metadata: Metadata = {
  title: "Super Admin | Medisys",
  robots: { index: false },
}

type Props = {
  searchParams: Promise<{ next?: string }>
}

export default async function SuperAdminLoginPage({ searchParams }: Props) {
  const sesion = await getSuperAdmin()
  if (sesion) redirect("/super-admin/dashboard")

  const { next } = await searchParams

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <SuperAdminLoginForm next={next} />
    </main>
  )
}
