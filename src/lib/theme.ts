/**
 * MEDISYS · Tema visual de los perfiles públicos.
 *
 * Módulo PURO (servidor + cliente) con la paleta por defecto, los presets
 * médicos recomendados, normalización tolerante y helpers para inyectar los
 * colores como variables CSS.
 */
import type { ThemeConfig } from "@/types/database"

/** Paleta neutra por defecto (Azul Clínico). */
export const TEMA_DEFECTO: ThemeConfig = {
  primaryColor: "#0284C7",
  secondaryColor: "#E0F2FE",
  backgroundColor: "#F8FAFC",
  cardBackgroundColor: "#FFFFFF",
  buttonTextColor: "#FFFFFF",
}

export type PresetTema = {
  id: string
  nombre: string
  descripcion: string
  colores: ThemeConfig
}

/** 3 paletas médicas recomendadas aplicables a 1 clic. */
export const PRESETS_TEMA: PresetTema[] = [
  {
    id: "azul-clinico",
    nombre: "Azul Clínico",
    descripcion: "Confianza y profesionalismo",
    colores: {
      primaryColor: "#0284C7",
      secondaryColor: "#E0F2FE",
      backgroundColor: "#F8FAFC",
      cardBackgroundColor: "#FFFFFF",
      buttonTextColor: "#FFFFFF",
    },
  },
  {
    id: "verde-medico",
    nombre: "Verde Médico",
    descripcion: "Bienestar y salud",
    colores: {
      primaryColor: "#0D9488",
      secondaryColor: "#CCFBF1",
      backgroundColor: "#F0FDF4",
      cardBackgroundColor: "#FFFFFF",
      buttonTextColor: "#FFFFFF",
    },
  },
  {
    id: "gris-premium",
    nombre: "Gris Elegante",
    descripcion: "Premium y sobrio",
    colores: {
      primaryColor: "#0F172A",
      secondaryColor: "#E2E8F0",
      backgroundColor: "#F8FAFC",
      cardBackgroundColor: "#FFFFFF",
      buttonTextColor: "#FFFFFF",
    },
  },
]

/** Campos editables del tema (usados por el editor del admin). */
export const CAMPOS_TEMA: {
  campo: keyof ThemeConfig
  label: string
  ayuda: string
}[] = [
  {
    campo: "primaryColor",
    label: "Color primario",
    ayuda: "Acciones y botones principales",
  },
  {
    campo: "secondaryColor",
    label: "Color secundario",
    ayuda: "Detalles y badges",
  },
  {
    campo: "backgroundColor",
    label: "Fondo de página",
    ayuda: "Fondo general del perfil público",
  },
  {
    campo: "cardBackgroundColor",
    label: "Fondo de tarjetas",
    ayuda: "Módulos, fichas y secciones",
  },
  {
    campo: "buttonTextColor",
    label: "Texto de botones",
    ayuda: "Color del texto sobre el botón principal",
  },
]

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** ¿El valor es un color HEX válido (#RGB o #RRGGBB)? */
export function esHexValido(valor: unknown): valor is string {
  return typeof valor === "string" && HEX_RE.test(valor.trim())
}

function colorODefecto(valor: unknown, porDefecto: string): string {
  return esHexValido(valor) ? valor.trim() : porDefecto
}

/** Normaliza cualquier forma de `theme_config` a una paleta completa. */
export function normalizarThemeConfig(raw: unknown): ThemeConfig {
  let datos: unknown = raw

  if (typeof datos === "string") {
    try {
      datos = JSON.parse(datos)
    } catch {
      datos = null
    }
  }
  if (!datos || typeof datos !== "object") return { ...TEMA_DEFECTO }

  const fila = datos as Record<string, unknown>
  return {
    primaryColor: colorODefecto(fila.primaryColor, TEMA_DEFECTO.primaryColor),
    secondaryColor: colorODefecto(fila.secondaryColor, TEMA_DEFECTO.secondaryColor),
    backgroundColor: colorODefecto(fila.backgroundColor, TEMA_DEFECTO.backgroundColor),
    cardBackgroundColor: colorODefecto(
      fila.cardBackgroundColor,
      TEMA_DEFECTO.cardBackgroundColor
    ),
    buttonTextColor: colorODefecto(
      fila.buttonTextColor,
      TEMA_DEFECTO.buttonTextColor
    ),
  }
}

/** Variables CSS inyectables en el contenedor del perfil público. */
export function temaCssVars(tema: ThemeConfig): Record<string, string> {
  return {
    "--primary-color": tema.primaryColor,
    "--secondary-color": tema.secondaryColor,
    "--bg-color": tema.backgroundColor,
    "--card-color": tema.cardBackgroundColor,
    "--button-text-color": tema.buttonTextColor,
  }
}
