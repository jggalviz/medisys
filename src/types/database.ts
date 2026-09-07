/**
 * MEDISYS · Tipos de base de datos (Supabase / PostgreSQL)
 * ----------------------------------------------------------
 * Fuente única de tipos para las tablas públicas del tenant médico.
 *
 * ESQUEMA ESPERADO (snake_case en Postgres, igual que los tipos JS):
 *  tenants
 *    id uuid pk, slug text unique, nombre text, logo_url text|null,
 *    telefono text|null, direccion text|null, is_active boolean,
 *    datos_pago_movil jsonb|null, created_at timestamptz
 *  profiles                 (pacientes: titular + familiares/menores)
 *    id uuid pk, tenant_id uuid fk, user_id uuid|null fk auth.users,
 *    nombres text, apellidos text, cedula text|null, telefono text|null,
 *    email text|null, fecha_nacimiento date|null, es_menor boolean,
 *    es_titular boolean, parentesco text|null, created_at timestamptz
 *  doctors
 *    id uuid pk, tenant_id uuid fk, nombres text, apellidos text,
 *    especialidad text, especialidades text[] (badges), foto_url text|null,
 *    precio_consulta numeric(10,2), activo boolean, created_at timestamptz
 *  schedules                (disponibilidad semanal por doctor)
 *    id uuid pk, tenant_id uuid fk, doctor_id uuid fk, dia_semana smallint,
 *    hora_inicio time, hora_fin time, duracion_min smallint, activo boolean
 *  appointments
 *    id uuid pk, tenant_id uuid fk, doctor_id uuid fk, patient_id uuid fk,
 *    fecha_hora timestamptz, estado text (ver AppointmentStatus),
 *    lock_expira_en timestamptz|null, referencia_pago text|null,
 *    telefono_emisor text|null, banco_origen text|null,
 *    comprobante_url text|null, created_at timestamptz
 *
 * CONVENCIONES:
 *  - fecha  -> 'YYYY-MM-DD';  hora -> 'HH:mm' (24h);  timestamptz -> ISO 8601.
 *  - dia_semana: 0=Domingo … 6=Sábado (igual a JS `getDay()` y a `EXTRACT(DOW)`).
 *  - `es_menor`/`es_titular` viven en la fila del paciente.
 *
 * RLS RECOMENDADO (para desplegar la app real):
 *  - SELECT público sobre tenants/doctors/schedules (is_active).
 *  - profiles: SELECT/INSERT para el usuario autenticado (user_id = auth.uid())
 *    y, opcionalmente, INSERT anónimo para carga rápida de pacientes en kiosco.
 *  - appointments: INSERT con estado 'pendiente' y UPDATE del comprobante
 *    sólo sobre filas propias (user_id = auth.uid() o paciente propio).
 *  - Bucket público 'comprobantes' con INSERT anónimo/autenticado.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json | undefined }

/** Minutos durante los cuales una cita queda bloqueada esperando el pago. */
export const LOCK_DURATION_MINUTES = 15

/** Zona horaria de Venezuela (America/Caracas, sin horario de verano). */
export const VE_TIMEZONE = "-04:00"

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export type AppointmentStatus =
  | "pendiente" // cupo bloqueado (lock de 15 min), esperando decisión de pago
  | "pendiente_validacion" // pagó en línea; la clínica debe validar comprobante/referencia
  | "pago_en_recepcion" // eligió pagar el día de la cita en recepción
  | "confirmada" // pago validado por la clínica
  | "completada"
  | "cancelada"
  | "expirada" // lock vencido sin pago (slot liberado)

export type PagoEstado =
  | "pendiente"
  | "en_revision" // comprobante recibido, esperando confirmación del tenant
  | "pagada"
  | "rechazada"

export type MetodoCobro = "pago_movil" | "zelle"

/* ------------------------------------------------------------------ */
/* tenants                                                             */
/* ------------------------------------------------------------------ */

/** Datos bancarios del tenant para Pago Móvil / Zelle. */
export type CuentaCobro = {
  metodo: MetodoCobro
  /** Nombre visible del banco, p. ej. "Banco Nacional de Crédito". */
  banco: string | null
  /** Titular de la cuenta o del correo Zelle. */
  titular: string
  /** Cédula o RIF asociado al pago móvil. */
  cedula_rif: string | null
  /** Teléfono registrado en el Pago Móvil (con prefijo 04xx…). */
  telefono: string | null
  /** Correo del Zelle (sólo si metodo === 'zelle'). */
  correo_zelle: string | null
}

export type DatosPagoMovil = {
  cuentas: CuentaCobro[]
  /** Instrucciones opcionales que verá el paciente en el paso de pago. */
  instrucciones: string | null
}

export type Tenant = {
  id: string
  slug: string
  nombre: string
  logo_url: string | null
  telefono: string | null
  direccion: string | null
  is_active: boolean
  datos_pago_movil: DatosPagoMovil | null
  created_at: string
}

export type TenantInsert = Omit<Tenant, "id" | "created_at"> & {
  id?: string
  created_at?: string
}

export type TenantUpdate = Partial<TenantInsert>

/* ------------------------------------------------------------------ */
/* profiles (pacientes)                                                */
/* ------------------------------------------------------------------ */

export type Profile = {
  id: string
  tenant_id: string
  /** Titular de la cuenta; null para registros creados por invitado. */
  user_id: string | null
  nombres: string
  apellidos: string
  cedula: string | null
  telefono: string | null
  email: string | null
  /** 'YYYY-MM-DD'. */
  fecha_nacimiento: string | null
  es_menor: boolean
  /** Indica si esta fila es el titular (perfil principal) de la cuenta. */
  es_titular: boolean
  /** p. ej. 'hijo/a', 'esposo/a', 'padre', 'madre' para familiares. */
  parentesco: string | null
  created_at: string
}

export type ProfileInsert = Omit<Profile, "id" | "created_at"> & {
  id?: string
  created_at?: string
}

export type ProfileUpdate = Partial<ProfileInsert>

/* ------------------------------------------------------------------ */
/* doctors                                                             */
/* ------------------------------------------------------------------ */

export type Doctor = {
  id: string
  tenant_id: string
  nombres: string
  apellidos: string
  /** Especialidad principal. */
  especialidad: string
  /** Especialidades adicionales / badges mostrados en la tarjeta. */
  especialidades: string[]
  foto_url: string | null
  /** Precio de consulta en bolívares (VES) o divisa según tenant. */
  precio_consulta: number
  activo: boolean
  created_at: string
}

export type DoctorInsert = Omit<Doctor, "id" | "created_at" | "especialidades" | "activo"> & {
  id?: string
  especialidades?: string[]
  activo?: boolean
  created_at?: string
}

export type DoctorUpdate = Partial<DoctorInsert>

/* ------------------------------------------------------------------ */
/* schedules                                                           */
/* ------------------------------------------------------------------ */

export type Schedule = {
  id: string
  tenant_id: string
  doctor_id: string
  /** 0=Domingo … 6=Sábado. */
  dia_semana: number
  /** 'HH:mm' (hora inicial de la jornada). */
  hora_inicio: string
  /** 'HH:mm' (hora final, no inclusiva). */
  hora_fin: string
  /** Duración de cada cupo en minutos (p. ej. 30). */
  duracion_min: number
  activo: boolean
}

export type ScheduleInsert = Omit<Schedule, "id" | "activo"> & {
  id?: string
  activo?: boolean
}

export type ScheduleUpdate = Partial<ScheduleInsert>

/* ------------------------------------------------------------------ */
/* appointments (reservas + lock de 15 min)                            */
/* ------------------------------------------------------------------ */

export type Appointment = {
  id: string
  tenant_id: string
  doctor_id: string
  /** Puede ser null si el cupo se reserva sin perfil (invitado). */
  patient_id: string | null
  /** ISO 8601 con offset (fecha_hora en hora local del tenant), p. ej. '2026-09-02T08:00:00-04:00'. */
  fecha_hora: string
  estado: AppointmentStatus
  lock_expira_en: string | null
  /** Turno elegido ('manana' | 'tarde'). Columna opcional según migración. */
  turno?: "manana" | "tarde" | null
  /** Hora referencial del turno ('08:00' o '13:00'). Columna opcional según migración. */
  hora?: string | null
  referencia_pago: string | null
  /** Opcional según migración: teléfono desde el que el paciente hizo el Pago Móvil. */
  telefono_emisor?: string | null
  /** Opcional según migración: banco de origen de la transferencia. */
  banco_origen?: string | null
  comprobante_url: string | null
  created_at: string
}

export type AppointmentInsert = Omit<
  Appointment,
  | "id"
  | "created_at"
  | "estado"
  | "lock_expira_en"
  | "referencia_pago"
  | "telefono_emisor"
  | "banco_origen"
  | "comprobante_url"
> & {
  id?: string
  created_at?: string
  patient_id?: string | null
  estado?: AppointmentStatus
  lock_expira_en?: string | null
  referencia_pago?: string | null
  telefono_emisor?: string | null
  banco_origen?: string | null
  comprobante_url?: string | null
}

export type AppointmentUpdate = Partial<AppointmentInsert>

/* ------------------------------------------------------------------ */
/* Tipado del cliente Supabase (createClient<Database>)                */
/* ------------------------------------------------------------------ */

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: Tenant
        Insert: TenantInsert
        Update: TenantUpdate
        Relationships: []
      }
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: ProfileUpdate
        Relationships: []
      }
      doctors: {
        Row: Doctor
        Insert: DoctorInsert
        Update: DoctorUpdate
        Relationships: []
      }
      schedules: {
        Row: Schedule
        Insert: ScheduleInsert
        Update: ScheduleUpdate
        Relationships: []
      }
      appointments: {
        Row: Appointment
        Insert: AppointmentInsert
        Update: AppointmentUpdate
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}

