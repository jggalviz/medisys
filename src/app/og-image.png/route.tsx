import { ImageResponse } from "next/og"

/**
 * MEDISYS · Imagen Open Graph estática servida en `/og-image.png` (1200×630).
 *
 * Se genera con `next/og` para no versionar binarios: el resultado es un PNG
 * real que WhatsApp, Facebook, LinkedIn y X pueden previsualizar.
 */
export const alt = "Medisys · Agenda y Gestión Médica en Venezuela"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #0f172a 0%, #0d9488 55%, #0891b2 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Marca */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "72px",
              height: "72px",
              borderRadius: "20px",
              background: "rgba(255,255,255,0.95)",
              color: "#0d9488",
              fontSize: "42px",
              fontWeight: 800,
            }}
          >
            +
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#ffffff", fontSize: "34px", fontWeight: 800 }}>
              Medisys
            </span>
            <span style={{ color: "rgba(255,255,255,0.75)", fontSize: "18px" }}>
              medisys.com.ve
            </span>
          </div>
        </div>

        {/* Titular */}
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          <span
            style={{
              color: "#ffffff",
              fontSize: "66px",
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-1.5px",
            }}
          >
            Agenda médica inteligente
          </span>
          <span
            style={{
              color: "rgba(255,255,255,0.92)",
              fontSize: "30px",
              lineHeight: 1.35,
            }}
          >
            Reservas online en 3 pasos · Expedientes médicos · Perfil público web ·
            Cobro en Bolívares a tasa BCV.
          </span>
        </div>

        {/* Chips */}
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
          {[
            "Plan Gratuito · hasta 30 reservas/mes",
            "Pago Móvil verificado",
            "Tasa oficial BCV",
            "Venezuela 🇻🇪",
          ].map((chip) => (
            <span
              key={chip}
              style={{
                display: "flex",
                padding: "12px 22px",
                borderRadius: "999px",
                background: "rgba(255,255,255,0.16)",
                border: "1px solid rgba(255,255,255,0.28)",
                color: "#ffffff",
                fontSize: "22px",
                fontWeight: 600,
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    ),
    size
  )
}
