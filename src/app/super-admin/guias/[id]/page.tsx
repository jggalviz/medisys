import { notFound } from "next/navigation"

import type { GuidePage } from "@/types/database"
import { getGuidePageById, listGuidePagesAdmin } from "@/app/actions/guides"
import { GuiaEditor } from "@/components/super-admin/GuiaEditor"

type Props = { params: Promise<{ id: string }> }

export default async function GuiaEditorPage({ params }: Props) {
  const { id } = await params
  const esNueva = id === "nueva"

  let inicial: GuidePage | null = null
  if (!esNueva) {
    const resultado = await getGuidePageById(id)
    if (!resultado.ok) {
      return (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          {resultado.message}
        </div>
      )
    }
    if (!resultado.data) notFound()
    inicial = resultado.data
  }

  const listado = await listGuidePagesAdmin()
  const categorias = listado.ok
    ? Array.from(new Set(listado.data.map((p) => p.category)))
    : []

  return <GuiaEditor inicial={inicial} categorias={categorias} />
}

