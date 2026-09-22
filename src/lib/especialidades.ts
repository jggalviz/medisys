/**
 * MEDISYS · Catálogo de especialidades médicas (módulo puro).
 *
 * Se usa en el registro público (`/registro`) para precargar la especialidad
 * del primer perfil médico de la cuenta. El selector siempre permite escribir
 * una especialidad fuera del catálogo (`ESPECIALIDAD_OTRA`), porque el campo en
 * base de datos (`doctors.especialidad`) es texto libre.
 */

/** Opción del selector que habilita el campo de texto libre. */
export const ESPECIALIDAD_OTRA = "otra"

/** Especialidad asumida cuando el usuario no indica ninguna. */
export const ESPECIALIDAD_POR_DEFECTO = "Medicina General"

export type OpcionEspecialidad = {
  /** Valor enviado al servidor (slug en minúsculas). */
  valor: string
  /** Nombre mostrado al usuario. */
  etiqueta: string
}

/** Catálogo de especialidades / áreas de práctica más frecuentes. */
export const ESPECIALIDADES_MEDICAS: readonly OpcionEspecialidad[] = [
  { valor: "medicina-general", etiqueta: "Medicina General" },
  { valor: "medicina-interna", etiqueta: "Medicina Interna" },
  { valor: "medicina-familiar", etiqueta: "Medicina Familiar" },
  { valor: "pediatria", etiqueta: "Pediatría" },
  { valor: "ginecologia-obstetricia", etiqueta: "Ginecología y Obstetricia" },
  { valor: "cardiologia", etiqueta: "Cardiología" },
  { valor: "dermatologia", etiqueta: "Dermatología" },
  { valor: "traumatologia", etiqueta: "Traumatología y Ortopedia" },
  { valor: "oftalmologia", etiqueta: "Oftalmología" },
  { valor: "otorrinolaringologia", etiqueta: "Otorrinolaringología" },
  { valor: "neurologia", etiqueta: "Neurología" },
  { valor: "psiquiatria", etiqueta: "Psiquiatría" },
  { valor: "psicologia", etiqueta: "Psicología" },
  { valor: "endocrinologia", etiqueta: "Endocrinología" },
  { valor: "gastroenterologia", etiqueta: "Gastroenterología" },
  { valor: "neumonologia", etiqueta: "Neumonología" },
  { valor: "nefrologia", etiqueta: "Nefrología" },
  { valor: "urologia", etiqueta: "Urología" },
  { valor: "reumatologia", etiqueta: "Reumatología" },
  { valor: "oncologia", etiqueta: "Oncología" },
  { valor: "hematologia", etiqueta: "Hematología" },
  { valor: "infectologia", etiqueta: "Infectología" },
  { valor: "alergologia", etiqueta: "Alergología" },
  { valor: "cirugia-general", etiqueta: "Cirugía General" },
  { valor: "anestesiologia", etiqueta: "Anestesiología" },
  { valor: "nutricion-dietetica", etiqueta: "Nutrición y Dietética" },
  { valor: "fisioterapia", etiqueta: "Fisioterapia y Rehabilitación" },
  { valor: "odontologia", etiqueta: "Odontología" },
  { valor: "radiologia", etiqueta: "Radiología e Imágenes" },
] as const

/** Etiqueta legible de una especialidad almacenada (catálogo o texto libre). */
export function etiquetaEspecialidad(valor: string | null | undefined): string {
  const limpio = String(valor ?? "").trim()
  if (!limpio) return ESPECIALIDAD_POR_DEFECTO
  const encontrada = ESPECIALIDADES_MEDICAS.find(
    (opcion) => opcion.valor === limpio.toLowerCase()
  )
  return encontrada?.etiqueta ?? limpio
}
