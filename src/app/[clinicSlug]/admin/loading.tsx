/**
 * Skeleton de carga mientras el RSC del panel ejecuta las consultas a la
 * base de datos (KPIs + agenda del día).
 */
export default function AdminLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Cargando panel"
      className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6"
    >
      <header className="flex animate-pulse items-center gap-3">
        <span className="size-10 rounded-full bg-muted" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="h-3 w-40 max-w-full rounded bg-muted" />
          <span className="h-5 w-64 max-w-full rounded bg-muted" />
          <span className="h-3 w-52 max-w-full rounded bg-muted" />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((clave) => (
          <div
            key={clave}
            className="flex animate-pulse flex-col gap-3 rounded-2xl border bg-card p-4"
          >
            <span className="size-9 rounded-xl bg-muted" />
            <div className="flex flex-col gap-1.5">
              <span className="h-3 w-3/4 rounded bg-muted" />
              <span className="h-6 w-1/2 rounded bg-muted" />
              <span className="h-3 w-2/3 rounded bg-muted" />
            </div>
          </div>
        ))}
      </section>

      <section className="flex animate-pulse flex-col gap-3">
        <span className="h-4 w-32 rounded bg-muted" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((clave) => (
            <span key={clave} className="h-[72px] rounded-2xl bg-muted/70" />
          ))}
        </div>
      </section>

      <section className="flex animate-pulse flex-col gap-3">
        <span className="h-4 w-44 rounded bg-muted" />
        <div className="flex flex-col overflow-hidden rounded-2xl border bg-card">
          {[0, 1, 2].map((clave) => (
            <div
              key={clave}
              className="flex items-center gap-3 border-b px-4 py-3.5 last:border-b-0"
            >
              <span className="h-4 w-12 rounded bg-muted" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="h-3.5 w-1/3 rounded bg-muted" />
                <span className="h-3 w-2/3 rounded bg-muted" />
              </div>
              <span className="h-6 w-20 rounded-full bg-muted" />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
