import { listGuidePagesAdmin } from "@/app/actions/guides"
import { GuiasManager } from "@/components/super-admin/GuiasManager"

export default async function GuiasPage() {
  const resultado = await listGuidePagesAdmin()

  if (!resultado.ok) {
    const faltaMigracion = /schema cache|does not exist|relation/i.test(resultado.message)
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
        <p className="font-semibold">No se pudieron cargar las guías.</p>
        <p>{resultado.message}</p>
        {faltaMigracion && (
          <p className="text-destructive/90">
            Parece que falta aplicar la migración <strong>0015_guide_pages.sql</strong> en
            Supabase (crea la tabla <code>guide_pages</code> y el bucket público
            <code> guides</code>).
          </p>
        )}
      </div>
    )
  }

  return <GuiasManager paginas={resultado.data} />
}

