import {
  CheckCircle2,
  Database,
  KeyRound,
  MapPin,
  MousePointerClick,
  Server,
} from "lucide-react"

import type { PermisoAdmin } from "@/lib/rbac"
import { ROL_LABEL, ROLES_SOPORTADOS, permisosDeRol } from "@/lib/rbac"
import { Panel, TD_CLASS, TH_CLASS, TablaScroll } from "@/components/caso-estudio/ui"

/** Lista sincronizada con la unión `PermisoAdmin` del módulo de RBAC. */
const PERMISOS: readonly PermisoAdmin[] = [
  "configuracion:leer",
  "configuracion:escribir",
  "fiscal:leer",
  "fiscal:escribir",
  "tasa:leer",
  "tasa:escribir",
  "servicios:leer",
  "servicios:escribir",
  "sedes:leer",
  "sedes:escribir",
  "usuarios:escribir",
  "cobros:recaudar",
  "cobros:registrar",
  "facturacion:leer",
  "facturacion:emitir",
  "facturacion:anular",
  "contabilidad:leer",
  "contabilidad:escribir",
  "honorarios:leer",
  "honorarios:escribir",
  "consulta:atender",
]

/** Las tres capas que responden la misma pregunta de autorización. */
const CAPAS = [
  {
    icon: Database,
    titulo: "Capa de datos · RLS",
    detalle:
      "Las 64 políticas de Postgres verifican pertenencia y rol mediante funciones SECURITY DEFINER (is_staff, is_tenant_admin, is_super_admin). Incluso con un error en el cliente, una consulta no puede leer ni escribir datos de otra clínica.",
  },
  {
    icon: Server,
    titulo: "Capa de servidor · Server Actions",
    detalle:
      "Antes de mutar, cada acción revalida el permiso con el mismo módulo puro que consume la interfaz. El panel pide sus datos por HTTP con la sesión en cookies: el navegador nunca maneja credenciales de servicio.",
  },
  {
    icon: MousePointerClick,
    titulo: "Capa de interfaz · UI",
    detalle:
      "La navegación se calcula con los permisos efectivos del rol: quien no puede guardar una configuración no ve el formulario, en lugar de descubrir el rechazo al enviarlo. La misma función decide a qué panel entra cada persona al iniciar sesión.",
  },
] as const

/** Reto 03 · Seguridad y RBAC granular por rol y sede. */
export function RetoRbac() {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-zinc-900 text-teal-300">
          <KeyRound className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Reto 03 · Seguridad y permisos
          </p>
          <h3 className="text-xl font-bold tracking-tight text-zinc-900">
            Cinco roles, veintiún permisos y varias sedes
          </h3>
        </div>
      </div>

      <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-600">
        En una clínica conviven un administrador, dos recepcionistas, cinco
        médicos, un contador externo y un operador de la plataforma. Todos usan
        el mismo panel y ninguno debe ver ni poder cambiar lo mismo. Ese reparto
        no puede vivir en el componente de turno: se aplica en tres capas, con
        una única fuente de verdad escrita una sola vez.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {CAPAS.map((capa) => {
          const Icono = capa.icon
          return (
            <Panel key={capa.titulo} tone="muted" className="p-5">
              <p className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                <Icono className="size-4 text-teal-700" aria-hidden="true" />
                {capa.titulo}
              </p>
              <p className="mt-2.5 text-sm leading-6 text-zinc-600">
                {capa.detalle}
              </p>
            </Panel>
          )
        })}
      </div>

      <p className="mt-4 flex items-start gap-2.5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
        <MapPin className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden="true" />
        <span>
          <span className="font-semibold text-zinc-800">Multi-sede:</span> cada
          persona se asigna a una o varias sedes (tenant_users.sede_ids) y la
          facturación usa la sede por defecto de la clínica. La lectura de esas
          asignaciones tolera entornos donde la migración todavía no se aplicó,
          así que un despliegue parcial no rompe el acceso.
        </span>
      </p>

      <div className="mt-6">
        <p className="text-sm font-bold text-zinc-900">
          Matriz real de permisos por rol
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
          Esta tabla no está escrita a mano: se calcula con permisosDeRol(), la
          misma función que usan los Server Actions y que define los helpers de
          las políticas RLS. Si el RBAC cambia, esta matriz cambia sola.
        </p>

        <TablaScroll>
          <table className="min-w-[40rem] border-collapse bg-white">
            <thead className="border-b border-zinc-200 bg-zinc-50">
              <tr>
                <th className={TH_CLASS}>Permiso</th>
                {ROLES_SOPORTADOS.map((rol) => (
                  <th key={rol} className={`${TH_CLASS} text-center`}>
                    <span className="block">{ROL_LABEL[rol]}</span>
                    <span className="mt-0.5 block font-mono text-[10px] font-normal text-zinc-400">
                      {permisosDeRol(rol).length} permisos
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {PERMISOS.map((permiso) => (
                <tr key={permiso} className="hover:bg-zinc-50/60">
                  <td className={`${TD_CLASS} whitespace-nowrap font-mono text-xs`}>
                    {permiso}
                  </td>
                  {ROLES_SOPORTADOS.map((rol) => (
                    <td key={rol} className="px-4 py-2.5 text-center">
                      {permisosDeRol(rol).includes(permiso) ? (
                        <CheckCircle2
                          className="mx-auto size-4 text-teal-600"
                          aria-label="Concedido"
                        />
                      ) : (
                        <span
                          className="font-mono text-sm text-zinc-300"
                          aria-label="No concedido"
                        >
                          ·
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TablaScroll>

        <p className="mt-3 text-xs leading-5 text-zinc-500">
          Los roles de la dimensión clínica (recepcion, especialista, medico,
          contador) se normalizan a uno de los cinco roles soportados, de modo que
          un dato heredado no pueda conceder permisos por accidente.
        </p>
      </div>
    </article>
  )
}
