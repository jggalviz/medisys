import Link from "next/link"
import { BookOpen } from "lucide-react"

/**
 * Enlace discreto a una guía del Centro de Ayuda.
 *
 * Se usa en las vistas de los módulos para llevar al usuario al instructivo
 * correspondiente (ruta pública `/guias/[slug]`, sin perder la sesión).
 */
export function EnlaceGuia({
  slug,
  children,
}: {
  slug: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={`/guias/${slug}`}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 transition-colors hover:underline"
    >
      <BookOpen className="size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </Link>
  )
}
