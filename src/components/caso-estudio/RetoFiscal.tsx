import { Coins, FileCheck2, Percent, Receipt, Scale } from "lucide-react"

import { Callout, CodePanel } from "@/components/caso-estudio/piezas"
import { Panel, TD_CLASS, TH_CLASS, TablaScroll } from "@/components/caso-estudio/ui"

/** Las tres normas venezolanas que conviven en una sola factura. */
const REGLAS = [
  {
    icon: Percent,
    titulo: "IVA del 16 % con exención médica",
    detalle:
      "La alícuota general es 16 %, pero los servicios médicos directos están exentos (Art. 17, numeral 4 de la Ley de IVA). En el modelo cada servicio del catálogo declara su condición: alicuotaIva(taxable) devuelve 0.16 o 0. El sistema no infiere la condición clínica del servicio; la clínica la declara una vez en el catálogo.",
  },
  {
    icon: Coins,
    titulo: "IGTF del 3 % solo cuando el cobro llega en divisas",
    detalle:
      "El impuesto a las grandes transacciones financieras grava los pagos en moneda extranjera. En lugar de asumir una regla global por país, cada método de cobro declara si lo causa: Zelle y efectivo en dólares lo causan; Pago Móvil, transferencia, efectivo en bolívares y punto de venta no.",
  },
  {
    icon: Receipt,
    titulo: "Doble despliegue y numeración de formas libres",
    detalle:
      "El catálogo se fija en dólares y la factura se emite a la tasa BCV del cobro: cada línea conserva subtotal, IVA y total en ambas monedas, con redondeo explícito a dos decimales para evitar desvíos de coma flotante. La numeración fiscal combina correlativo y número de control, y el IGTF se recalcula cada vez que se registra un cobro.",
  },
] as const

/** Reglas reales del motor de cobros: moneda, IGTF y referencia exigida. */
const METODOS = [
  { metodo: "Pago Móvil", moneda: "VES", igtf: "No aplica", referencia: "Sí (4 a 8 dígitos)" },
  { metodo: "Transferencia (Bs.)", moneda: "VES", igtf: "No aplica", referencia: "Sí" },
  { metodo: "Efectivo Bs.", moneda: "VES", igtf: "No aplica", referencia: "No" },
  { metodo: "Punto de venta", moneda: "VES", igtf: "No aplica", referencia: "No" },
  { metodo: "Zelle", moneda: "USD", igtf: "3 %", referencia: "Sí" },
  { metodo: "Efectivo USD", moneda: "USD", igtf: "3 %", referencia: "No" },
] as const

/** Reto 02 · Suite fiscal SENIAT automatizada. */
export function RetoFiscal() {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-zinc-900 text-teal-300">
          <Scale className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Reto 02 · Cumplimiento fiscal
          </p>
          <h3 className="text-xl font-bold tracking-tight text-zinc-900">
            Una factura que tres normas exigen a la vez
          </h3>
        </div>
      </div>

      <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-600">
        La factura venezolana no es un recibo con un porcentaje: es un documento
        con condiciones de aplicación. El IVA depende de si el servicio es
        gravado o exento, el IGTF depende del medio de pago y el desglose debe
        mostrarse en bolívares a la tasa del día y en dólares. Traducir cada
        norma a código fue el trabajo más delicado del proyecto, porque un error
        aquí no es un bug estético: es una contingencia fiscal para el cliente.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {REGLAS.map((regla) => {
          const Icono = regla.icon
          return (
            <Panel key={regla.titulo} tone="muted" className="p-5">
              <p className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                <Icono className="size-4 text-teal-700" aria-hidden="true" />
                {regla.titulo}
              </p>
              <p className="mt-2.5 text-sm leading-6 text-zinc-600">
                {regla.detalle}
              </p>
            </Panel>
          )
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.15fr] lg:items-start">
        <Panel tone="muted" className="p-5">
          <p className="text-sm font-bold text-zinc-900">
            Reglas por método de cobro
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            La condición del impuesto vive junto al método que la causa, no en un
            condicional escondido en la pantalla de cobro.
          </p>
          <TablaScroll>
            <table className="min-w-[30rem] border-collapse bg-white">
              <thead className="border-b border-zinc-200 bg-zinc-50">
                <tr>
                  <th className={TH_CLASS}>Método</th>
                  <th className={TH_CLASS}>Moneda</th>
                  <th className={TH_CLASS}>IGTF</th>
                  <th className={TH_CLASS}>Referencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {METODOS.map((metodo) => (
                  <tr key={metodo.metodo}>
                    <td
                      className={`${TD_CLASS} whitespace-nowrap font-semibold text-zinc-900`}
                    >
                      {metodo.metodo}
                    </td>
                    <td className={`${TD_CLASS} font-mono text-xs`}>
                      {metodo.moneda}
                    </td>
                    <td
                      className={`${TD_CLASS} whitespace-nowrap ${
                        metodo.igtf === "No aplica"
                          ? "text-zinc-500"
                          : "font-semibold text-amber-700"
                      }`}
                    >
                      {metodo.igtf}
                    </td>
                    <td className={`${TD_CLASS} whitespace-nowrap`}>
                      {metodo.referencia}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablaScroll>
        </Panel>

        <div className="space-y-4">
          <CodePanel
            ruta="src/lib/fiscal-ve.ts"
            nota="Funciones puras: mismos resultados en el servidor, en el navegador y en un script de verificación."
          >{`/** Alícuota general del IVA vigente en Venezuela (16 %). */
export const IVA_VENEZUELA = 0.16

/** RIF canónico: \`V-12345678-9\`. */
export const RIF_REGEX = /^([VEJG])-(\\d{8})-(\\d)$/

/** Cédula canónica: \`V-12345678\`. */
export const CEDULA_REGEX = /^([VE])-(\\d{6,9})$/

/** 16 % si la línea está gravada; 0 si es un servicio médico exento. */
export function alicuotaIva(taxable: boolean): number {
  return taxable ? IVA_VENEZUELA : 0
}`}</CodePanel>

          <CodePanel
            ruta="src/lib/billing-ve.ts"
            nota="El IGTF no se pregunta en la pantalla de cobro: se deduce del método registrado."
          >{`/** Alícuota del IGTF vigente en Venezuela (3 %). */
export const ALICUOTA_IGTF = 0.03

/** IGTF de un monto en USD (3 %), redondeado a 2 decimales. */
export function calcularIgtf(montoUSD: number): number {
  if (!Number.isFinite(montoUSD) || montoUSD <= 0) return 0
  return redondear2(montoUSD * ALICUOTA_IGTF)
}

export function desglosarCobro(entrada: {
  metodo: PaymentMethod
  montoUSD?: number
  montoVES?: number
  tasa: number
}): DesgloseCobro {
  const info = infoMetodoCobro(entrada.metodo)

  // La base se expresa siempre en USD (moneda de la factura).
  const baseUSD =
    entrada.montoUSD !== undefined && Number.isFinite(entrada.montoUSD)
      ? redondear2(Math.max(0, entrada.montoUSD))
      : aUsd(entrada.montoVES ?? 0, entrada.tasa)

  const igtf = info.aplicaIgtf ? calcularIgtf(baseUSD) : 0
  const total = redondear2(baseUSD + igtf)

  // …se devuelven además los equivalentes en VES a la tasa del cobro.
  return { metodo: entrada.metodo, aplicaIgtf: info.aplicaIgtf,
    baseUSD, baseVES: aVes(baseUSD, entrada.tasa),
    igtfUSD: igtf, igtfVES: aVes(igtf, entrada.tasa),
    totalUSD: total, totalVES: aVes(total, entrada.tasa) }
}`}</CodePanel>

          <Callout
            icon={FileCheck2}
            titulo="El mismo módulo valida los documentos fiscales"
          >
            <p className="text-sm leading-6">
              RIF (V, E, J, G), cédula y pasaporte se normalizan a un formato
              canónico antes de tocar la base de datos, y todas las conversiones
              pasan por un redondeo a dos decimales para que el total que ve el
              paciente, el que registra caja y el que imprime la factura sean
              exactamente el mismo número.
            </p>
          </Callout>
        </div>
      </div>
    </article>
  )
}
