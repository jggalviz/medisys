# Medisys

### Multi-tenant medical scheduling, clinical records and a SENIAT-ready fiscal suite for Venezuela

[![Next.js](https://img.shields.io/badge/Next.js-16.3.4-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2.8-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x_strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres_·_Auth_·_Storage_·_RLS-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Deploy](https://img.shields.io/badge/Deploy-Vercel_+_Cron-000000?logo=vercel&logoColor=white)](https://vercel.com)
[![Node](https://img.shields.io/badge/Node.js-%E2%89%A520.9-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Proprietary-red)](#license--credits)

> **Version `0.1.0`** · Spanish-first product UI (`es-VE`) · single-deployment SaaS on Vercel.
> Source-code comments and domain vocabulary are in Spanish; public documentation is in English.

---

## Table of Contents

- [Short Pitch](#short-pitch)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture & Workflow](#architecture--workflow)
- [Getting Started](#getting-started)
- [Usage Examples](#usage-examples)
- [Roadmap](#roadmap)
- [License & Credits](#license--credits)

---

## Short Pitch

**Medisys** is a multi-tenant SaaS that lets Venezuelan clinics, group practices and independent physicians take
appointments 24/7 and collect payment without hiring a call centre: patients pick a specialist and shift on a public,
SEO-indexed clinic profile, upload a **Pago Móvil** receipt, and reception validates it from the very panel that runs
the day. The whole product is one **Next.js 16** application — React Server Components, Server Actions and Route
Handlers — deployed on Vercel, with **Supabase Postgres** (schema + Row Level Security + Auth + Storage) as the single
source of truth, so there is no separate backend service to build, secure or scale. Beyond the operational core it
ships three back-office modules engineered around Venezuelan regulation: **fiscal entity + multi-currency at the
official BCV rate**, **SENIAT invoicing & collections (IVA / IGTF)**, and **accounting (sales book, daily cash
closing, doctor settlements)**.

---

## Key Features

### 1 · Public booking & patient experience

- **3-step booking wizard** (`/[clinicSlug]/reservar`): patient (self or dependent/minor) → specialty & specialist → date & shift (`mañana` / `tarde`), every step server-validated through Server Actions.
- **15-minute slot lock**: the chosen slot is created as a `pendiente` appointment with `lock_expira_en = now + 15 min`; a live countdown releases it (`cancelada` while the lock is active, `expirada` once it lapsed) when the patient steps back or runs out of time. Expired locks stop blocking the shift.
- **Unlimited bookings per shift** (migrations `0002` / `0003`): no per-slot capacity ceiling, ideal for "order of arrival" shifts. Schema-tolerant inserts (`PGRST204` fallback) keep working on not-yet-migrated databases.
- **Permanent booking link + public profile** for every tenant, rendered fresh per request (`dynamic = "force-dynamic"`) with per-clinic `generateMetadata` for Google and social previews.
- **Payment proof without leaving the flow**: the patient chooses *pay online* (Pago Móvil / Zelle reference + receipt uploaded to Supabase Storage) or *pay at reception*.
- **Downloadable receipt**: `jsPDF` + `html2canvas` render an off-screen receipt card into a PDF, and a one-tap **WhatsApp** share link (`wa.me`) pre-formats the appointment summary (code, patient, specialist, date, shift, status and payment method).
- **Patient portal** (`/[clinicSlug]/paciente`): passwordless access with **ID card + phone**, read-only access to the digital record (`expediente`).

### 2 · Payments & collections

- **Two deliberately decoupled money layers**: appointment payments (booking flow / reception desk) and fiscal invoicing (Module 2, below).
- **Reception console** (`/[clinicSlug]/admin/recepcion`): live day agenda and the full visit state machine — arrival → waiting room → in consultation → attended.
- **Payment verification queue** (`/[clinicSlug]/admin/pagos`): reception compares the uploaded receipt and reference against bank movements, then confirms or rejects the appointment in one click.
- **Cash desk**: registration of cash, point-of-sale and Pago Móvil collections, feeding daily closings and settlements.
- **Multi-currency by design**: catalog prices are stored in **USD** and displayed in **USD + VES** using the official BCV rate in force at collection time.

### 3 · Multi-tenant identity, RBAC & security

- **Two authentication planes**: Supabase Auth (email + password) for clinic staff, and a lightweight signed session for specialist/patient portals.
- **Staff membership** resolved per tenant through `tenant_users`; platform operators are identified by `user_metadata.role = "super_admin"`.
- **Route guard** in `src/proxy.ts` (Next.js 16 renamed Middleware to *Proxy*): protects `/:clinicSlug/admin/*`, bounces already-authenticated users away from `/:clinicSlug/login`, and gates `/super-admin/*` to platform operators. `/api/**` is intentionally excluded because every Route Handler authenticates and authorises itself.
- **Portal sessions** (`portal_session`) are `httpOnly` cookies signed with **HMAC-SHA256** (`PORTAL_SESSION_SECRET`), 30-day TTL: readable payload, tamper-proof integrity.
- **21 granular permissions across 5 roles** — `admin`, `recepcion`, `especialista`, `medico` (alias), `contador` (`src/lib/rbac.ts`) — enforced in three layers: RLS policies, Route Handlers (`resolverContextoAdmin`) and Server Actions.
- **Multi-location (multi-sede) scoping** via `tenant_users.sede_ids` (empty array = access to every location).
- **Defence in depth**: RLS enabled on all module tables with `security definer` helpers (`is_staff`, `is_tenant_admin`, `is_any_tenant_admin`, `is_super_admin`, `puede_facturar`, `puede_contabilizar`); the `service_role` key is only ever used inside trusted server code (cron, portal auth, bucket bootstrap).

### 4 · Module 1 — Administration, fiscal profile & catalog

- **Fiscal entity** (`razon_social`, `domicilio_fiscal`, `email_fiscal`, `imprenta_autorizada`, `providencia_formas_libres`) — the minimum required to issue SENIAT-compliant documents.
- **Locations (sedes)** CRUD with per-location fiscal counters used by invoicing.
- **Medical services catalog**: price in USD, taxable/exempt flag, assigned specialist and **doctor commission** (`PERCENTAGE` or `FIXED USD`, capped at the service price).
- **Settings API** (`GET`/`PATCH /api/admin/settings`) returns clinic role, permissions, fiscal profile, locations and the live BCV rate in a single payload.

### 5 · BCV exchange-rate engine & multi-currency

- **Resilient cascade** (`src/lib/bcv.ts`): live scrape of `bcv.org.ve` → public APIs (`ve.dolarapi.com`, `dolarapi.com`, `pydolarve.org`) → last persisted row in `bcv_rates` → hard-coded fallback (`36.5`). It never throws.
- **BCV portal TLS workaround**: the official site publishes an incomplete certificate chain (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`), so one server-side retry with relaxed TLS is performed; disable it with `BCV_TLS_ESTRICTO=1`.
- **Manual override always wins**: an admin-set rate (`source = MANUAL`) takes precedence over the automatic one, and both can coexist for the same day for audit purposes.
- **Daily persistence**: Vercel Cron calls `GET /api/cron/bcv-rate` at `12:00 UTC` and upserts the official rate using the `service_role` client, retrying progressively simpler payload shapes to tolerate schema drift.
- **Caching discipline**: outbound rate lookups use `next: { revalidate: 3600 }`, 10-second timeouts and a real browser User-Agent; the marketing landing page is ISR-revalidated every 5 minutes.
- **Deterministic money math**: money is rounded to 2 decimals and rates to 4 (matching `numeric(18,4)`) to prevent floating-point drift in fiscal totals.

### 6 · Module 2 — SENIAT invoicing & collections

- **Invoice emission** with **dual USD/VES deployment** at the BCV rate used for the collection, line-by-line detail, optional doctor attribution and optional immediate payment.
- **IVA rules**: 16% general rate on taxable lines; direct medical services are typically **exempt** (`taxable = false`, Art. 17 §4 of the Venezuelan VAT law).
- **IGTF 3%** applied automatically to foreign-currency collections (Zelle, cash USD) and never to Pago Móvil, VES transfers, VES cash or point of sale.
- **Fiscal numbering**: `fiscal_counters` holds the invoice correlative and the SENIAT **control number for free forms** (`{control_prefix}-00000042`), per tenant and optionally per location, incremented with a compare-and-swap so concurrent cashiers cannot duplicate numbers.
- **Collections** registerable as `PENDING_VERIFICATION`, `VERIFIED` or `REJECTED`, with partial payments and automatic recalculation of invoice collection status (`PENDING` / `PARTIAL` / `PAID`).
- **Credit and debit notes** linked to invoices: cancelling an invoice issues a credit note instead of destroying fiscal history.
- **Pre-flight fiscal validation** (`faltantesDatosFiscales`) blocks emission until document type, ID number, legal name and fiscal address are present.

### 7 · Module 3 — Accounting & fiscal books

- **SENIAT sales book** (`GET /api/admin/reports/sales-book`) in the official column order — date, RIF/ID, name, invoice number, control number, credit/debit notes, total incl. IVA, exempt sales, taxable base, rate, debited IVA and withheld IGTF — plus monthly consolidation and **CSV export** ready for Excel/Google Sheets.
- **Daily cash closing (arqueo)**: expected vs. counted totals in USD and VES, **breakdown per collection method**, variance detection (over/short) with cent-level tolerance and the status flow `OPEN → CLOSED → AUDITED`.
- **Doctor settlements**: extracts billable lines from collected invoices, applies the agreed commission (percentage or fixed) and computes the net payable per specialist.
- **Documented invariants**: every calculation lives in `src/lib/accounting-ve.ts` and `src/lib/billing-ve.ts` as pure, dependency-free functions, importable from client components and trivially unit-testable.

### 8 · SaaS operations — plans, onboarding & Super Admin

- **Commercial tiers**: `INDIVIDUAL` (1 specialist — $10/mo · $100/yr), `PYME` (2–10 — $40/mo · $400/yr) and `PRO` (10+, multi-location — $80/mo · $800/yr); annual billing equals 10 months. Legacy plan values (`CLINICA`, the old single-doctor `PRO`, `independiente`, `multi_especialista`) are normalised automatically.
- **Freemium entry**: the first **10 bookings are free** on every tier, and the landing CTA carries the offer.
- **Super Admin console** (`/super-admin`): cross-tenant KPI snapshot, client onboarding wizard (tenant + location + staff + fiscal data), plan/quota management, tenant activation toggles and subscription-payment approval/rejection.
- **Membership lifecycle**: `suscripcion_vence_at` drives the panel banner, a self-service renewal page with Pago Móvil instructions and a 5-day advance warning window.
- **Knowledge-base management** from the Super Admin (`/super-admin/guias`) with image uploads to the `guides` storage bucket.

### 9 · Public profile, help centre & SEO

- **Per-tenant public landing** (`/[clinicSlug]`) driven by `landing_config`: hero, about, schedules, services, FAQ, accepted payment methods, emergency/telemedicine badges, MPPS / medical-board / university credentials, social handles and detailed address + landmark.
- **Theme engine** (`theme_config`): three medical presets (Clinical Blue, Medical Green, Elegant Grey) plus free HEX colours, injected as CSS custom properties into the public profile.
- **Help centre** (`/guias`, `/guias/[slug]`) and an in-panel knowledge base built on `guide_pages`, rendered by a **custom, dependency-free Markdown renderer** that escapes input first (no XSS) and only allows `http(s)` and internal URLs.
- **SEO / Open Graph**: global metadata with keywords, Open Graph and Twitter Cards, per-tenant metadata, and a **dynamically generated OG image** at `/og-image.png` (`next/og` `ImageResponse`, 1200×630) so no binary asset is versioned.

### 10 · Engineering conventions that make the product hold up

- **Schema-tolerant data access**: queries degrade gracefully when a migration is missing (`PGRST204` / `PGRST205` are detected and retried with a minimal payload), so an un-migrated database degrades instead of crashing.
- **No-throw result contracts**: Server Actions return `ActionResult<T>` and module services return `AdminModuleResult<T>` — discriminated unions mapped to coherent HTTP status codes (401/403/404/409/422/503/500) by `responder()`.
- **Validation without extra dependencies**: `src/lib/validations/*` implements Zod-compatible primitives (`safeParse`, `parse`, `error.issues`) in ~0 KB, deliberately designed to be swapped for Zod later.
- **Single source of truth for types**: `src/types/database.ts` documents and types the whole Postgres schema, while `src/lib/{fiscal,billing,accounting}-ve.ts` own every Venezuelan business rule as pure functions.
- **Server-only secrets**: the `service_role` client is confined to `src/lib/supabase/admin.ts` and never imported by client components; the panel speaks to `/api/admin/*` over HTTP with the browser session and never handles service credentials.
- **Zero AI/LLM dependencies today**: no model, embedding or third-party AI API is used anywhere in the runtime — every automated decision (rate resolution, VAT/IGTF, cash variance) is deterministic, auditable code. AI-assisted features are tracked in the [Roadmap](#roadmap).

---

## Tech Stack

### Application & UI

| Technology | Version | Role in Medisys |
| --- | --- | --- |
| **Next.js** (App Router) | `16.3.4` | Single deployment target: RSC pages, Server Actions for mutations, Route Handlers for the JSON API, `proxy.ts` route guard, `next/og` image generation, ISR for the landing page |
| **React** | `19.2.8` | Server Components by default, client components only for interactive surfaces (booking wizard, managers, editors) |
| **TypeScript** | `5.x` (`strict: true`) | End-to-end typing; the DB schema is typed in `src/types/database.ts` and shared by client and server |
| **Tailwind CSS** | `v4` | Utility-first styling driven from `src/app/globals.css` (`@theme inline`, CSS variables) |
| **tw-animate-css** | `1.4.x` | Animation utilities on top of Tailwind v4 |
| **shadcn/ui** (`base-nova` style) | `4.20.x` | Component conventions + `components.json`; primitives in `src/components/ui/*` |
| **@base-ui/react** | `1.7.x` | Headless accessible primitives used by the UI layer |
| **lucide-react** | `1.39.x` | Icon system |
| **class-variance-authority · clsx · tailwind-merge** | `0.7.x · 2.1.x · 3.6.x` | Variant composition and class merging (`cn()` helper) |
| **next/font** (Google) | — | Plus Jakarta Sans (UI) and Geist Mono (numerics) self-hosted at build time |

### Backend, data & platform

| Technology | Version | Role in Medisys |
| --- | --- | --- |
| **Supabase Postgres** | managed | Single source of truth: tenants, appointments, clinical records, currency rates, fiscal counters, invoices, closings |
| **Supabase Row Level Security** | — | Tenant isolation enforced in the database with `security definer` helpers; every module table has explicit policies |
| **Supabase Auth** | — | Staff and Super Admin credentials (`tenant_users` membership, `user_metadata.role`) |
| **Supabase Storage** | — | Public buckets `branding` (logos), `comprobantes` (payment receipts), `guides` (KB images), bootstrapped idempotently at runtime |
| **@supabase/ssr** | `0.12.5` | Cookie-bound Supabase clients for RSC, Server Actions and Route Handlers (`getAll`/`setAll`) |
| **@supabase/supabase-js** | `2.114.0` | Browser client (receipt upload) and `service_role` client (cron, portals, storage) |
| **Route Handlers / Server Actions** | Next.js 16 (Node.js runtime) | The product's API layer — no separate backend service, no serverless microservice sprawl |
| **Custom validation layer** | — | Zod-compatible schemas (`safeParse` / `parse` / `issues`) in `src/lib/validations/*` — no external validation dependency |
| **Custom Markdown renderer** | — | Escape-first, dependency-free Markdown → HTML for the knowledge base |

### Documents, integrations & tooling

| Technology | Version | Role in Medisys |
| --- | --- | --- |
| **jsPDF** | `4.2.1` | Client-side PDF generation for appointment receipts / vouchers |
| **html2canvas** | `1.4.1` | Renders the branded receipt card to canvas before exporting with jsPDF |
| **bcv.org.ve** | — | Primary source of the official USD/VES rate (HTML scrape of the daily quote) |
| **dolarapi.com · pydolarve.org** | — | Fallback rate APIs used when the BCV portal is unreachable or blocks the request |
| **WhatsApp deep links** (`wa.me`) | — | Zero-dependency sharing of the appointment summary with the clinic |
| **Vercel** | — | Hosting, edge/Node runtime and Cron (`vercel.json` → `/api/cron/bcv-rate` daily at `12:00 UTC`) |
| **Vercel CLI / Supabase CLI** | optional | Deployment and `supabase db push` workflows |
| **ESLint** (`eslint-config-next`) | `9.x` / `16.3.4` | `core-web-vitals` + TypeScript rules (`npm run lint`) |
| **Node.js** | `>= 20.9.0` | Required by Next.js 16 |
| **npm** | `10+` | Package management and scripts (`dev`, `build`, `start`, `lint`) |
| **AI / ML runtimes** | — | **None.** No OpenAI/Anthropic/Gemini SDK, no vector store, no model inference in the current codebase |

---

## Architecture & Workflow

### System overview

```text
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ Vercel · Node.js runtime — Next.js 16 App Router (single deployable unit)   │
  │ • RSC pages       per-tenant server rendering, cookie-bound Supabase client │
  │ • Server Actions  booking, admin, portals, onboarding, licensing            │
  │ • Route Handlers  /api/admin/*   ·   /api/cron/bcv-rate                     │
  │ • proxy.ts        session + tenant membership + super-admin route guard     │
  └─────────────────────────────────────────────────────────────────────────────┘
                                        │ @supabase/ssr (cookies) · service_role (server only) · HTTPS
                                        ▼
  ┌──────────────────────┐  ┌───────────────────────┐  ┌──────────────────────────┐
  │ Supabase Auth        │  │ Supabase Storage      │  │ BCV rate sources         │
  │ staff · super admin  │  │ branding (logos)      │  │ bcv.org.ve → dolarapi    │
  │ memberships · roles  │  │ comprobantes          │  │ → pydolarve (1 h cache)  │
  │                      │  │ guides (KB images)    │  │                          │
  └──────────────────────┘  └───────────────────────┘  └──────────────────────────┘
                                        │
                                        ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ Supabase Postgres — RLS enforced on every tenant-owned table                │
  │ tenants · tenant_users · profiles · doctors · schedules                     │
  │ appointments · medical_records · sedes · medical_services                   │
  │ currency_rates · bcv_rates · fiscal_counters · invoices                     │
  │ invoice_items · payments · credit/debit notes · daily_closings              │
  │ doctor_settlements · guide_pages · saas_subscription_payments               │
  └─────────────────────────────────────────────────────────────────────────────┘
```

### Request flows

**A · Public booking (patient, no account required)**

```text
/[clinicSlug]/reservar
  1. RSC resolves the tenant by slug (active only)  ─▶ BookingWizard (client)
  2. Server Action getAvailableSlots(doctorId, date) ─▶ schedules + appointments → free slots
  3. Server Action lockAppointmentSlot(...)          ─▶ INSERT appointment 'pendiente'
                                                        + lock_expira_en = now + 15 min
  4. Step 4 · Pago Móvil in-line                     ─▶ upload receipt to Storage 'comprobantes'
     registerAppointmentPayment(...)                 ─▶ estado = 'pendiente_validacion'
     — or — pay at reception                         ─▶ estado = 'pago_en_recepcion'
  5. Countdown expires or the patient steps back     ─▶ releaseLockedSlot() → 'expirada' / 'cancelada'
```

**B · Reception validation (staff)**

```text
/registro            ─▶ registrarConsultorio() (Server Action, service_role):
   plan selector (radio-cards: INDIVIDUAL · PYME · PRO)
   Auth user (bcrypt) + tenants (unique slug, plan_type, max_especialistas
   = cupoInicialRegistro(plan)) + tenant_users 'admin' + first doctors row
   reservas_consumidas = 0 · signInWithPassword() → session cookie → /[slug]/admin?bienvenida=1
   (same screen has the "Iniciar sesión" tab → signInStaffGlobal(), no clinic slug required)
/[clinicSlug]/login  ─▶ Supabase Auth (password) ─▶ tenant_users membership check
/[clinicSlug]/admin/pagos
  pending payments list ─▶ reception compares reference + receipt vs. bank movement
  validatePayment() ─▶ estado 'confirmada' | 'pago_rechazado'  (RLS + permission 'cobros:registrar')
/[clinicSlug]/admin/recepcion
  day agenda ─▶ estado machine: confirmada → en_espera → en_consulta → atendido → completada
  cash desk  ─▶ payment registered in VES at the BCV rate of the day
```

**C · Fiscal invoicing & accounting (Modules 2 + 3)**

```text
admin/facturacion ─▶ POST /api/admin/invoices
   ① fiscal pre-flight      faltantesDatosFiscales()        → blocks emission if data is missing
   ② rate resolution        getTasaVigente()                → manual > BCV day > stored > fallback
   ③ line engine            calcularLineaFactura()          → subtotal + IVA(16% | exempt) in USD & VES
   ④ fiscal numbering       fiscal_counters (compare-and-swap) → N° 00000042 · control 00-00000042
   ⑤ persistence            invoices + invoice_items (+ payments when collected on the spot)
   ⑥ numbering, cancel      credit_notes / debit_notes instead of destructive deletes

admin/contabilidad ─▶ GET /api/admin/reports/sales-book?anio=&mes=&formato=csv
                   ─▶ daily_closings   (expected vs. counted, variance per method)
                   ─▶ doctor_settlements (commission PERCENTAGE | FIXED → net payable)
```

**D · Official BCV rate (Vercel Cron, daily `12:00 UTC`)**

```text
GET /api/cron/bcv-rate           Authorization: Bearer $CRON_SECRET
  obtenerTasaBcvEnVivo()   scraping bcv.org.ve → ve.dolarapi.com → dolarapi.com → pydolarve.org
  UPSERT bcv_rates         service_role client, payload shapes retried until the schema matches
  ↓
currency_rates           admin UI can force a MANUAL rate; the engine prefers it over the automatic one
```

### Domain rules baked into the code

| Rule | Where it lives | Behaviour |
| --- | --- | --- |
| Timezone | `src/lib/date.ts`, `VE_TIMEZONE = "-04:00"` | Every shift is interpreted as Caracas local time, independent of the server region (Vercel runs in UTC) |
| Slot lock | `LOCK_DURATION_MINUTES = 15` | A `pendiente` appointment blocks nothing once `lock_expira_en` has passed |
| Unlimited shifts | migrations `0002` / `0003` | No `max_slots_per_shift` enforcement yet (column reserved for a future release) |
| VAT (IVA) | `IVA_VENEZUELA = 0.16` | 16% on taxable lines, 0% on exempt direct medical services |
| IGTF | `ALICUOTA_IGTF = 0.03` | 3% only on `ZELLE` and `EFECTIVO_USD`; never on VES instruments |
| Rounding | `redondear2` / `redondear4` | Money at 2 decimals; rates at 4 decimals (`numeric(18,4)`) |
| Fiscal numbering | `fiscal_counters`, `formatearNumeroFactura`, `formatearNumeroControl` | 8-digit correlative + `{prefix}-00000042` control number, per tenant (optionally per location) |
| Rate precedence | `src/lib/currency-rates.ts` | `MANUAL` > today's BCV > last stored > `TASA_BCV_FALLBACK` |
| Cash tolerance | `TOLERANCIA_ARQUEO_USD = 0.01` | A closing counts as balanced inside a one-cent tolerance |

### Data model highlights

| Table | Purpose |
| --- | --- |
| `tenants` | Clinic/consultation: slug, branding, contact, fiscal entity, plan, landing & theme config, subscription expiry, free-trial booking counter (`reservas_consumidas`) |
| `tenant_users` | Staff membership per tenant: role (`admin` / `recepcion` / `especialista` / `medico` / `contador`) + assigned `sede_ids` |
| `profiles` | Patients: holders, dependants and minors, plus fiscal identity per patient |
| `doctors` · `schedules` | Specialists (specialty, photo, price, active flag) and their weekly availability |
| `appointments` | Bookings with shift, status machine, slot lock, payment reference, receipt URL and issuing bank |
| `medical_records` | Consultation history per patient (specialist portal, patient portal) |
| `sedes` · `medical_services` | Locations and billable service catalog with per-service doctor commission |
| `currency_rates` · `bcv_rates` | System exchange-rate engine (manual/auto) and the official daily rate history used as fallback |
| `fiscal_counters` | Invoice correlative and SENIAT control-number pointers per tenant/location/document type |
| `invoices` · `invoice_items` | Fiscal invoices with dual USD/VES amounts, IVA and IGTF, plus per-line detail and doctor attribution |
| `payments` · `credit_notes` · `debit_notes` | Multi-currency collections and linked adjustment notes |
| `daily_closings` · `doctor_settlements` | Cash closings per day/location and doctor fee settlements |
| `guide_pages` · `saas_subscription_payments` | Knowledge-base articles and SaaS subscription payment reports |

### Migrations

All migrations are **idempotent** and meant to be applied in order (SQL Editor, `supabase db push`, or the helper
scripts in `scripts/`).

| Files | Adds |
| --- | --- |
| `0001`–`0003` | Multi-tenant auth, `tenant_users`, RLS helpers, open (unlimited) shifts, removal of the unique active-appointment constraint |
| `0004`–`0006` | Tenant settings (RIF, address, Pago Móvil accounts), specialist management fields, dashboard pricing |
| `0007`–`0010` | `bcv_rates`, portals (`medical_records`), tenant plans & quotas, subscriptions (`suscripcion_vence_at`, `saas_subscription_payments`) |
| `0011`–`0015` | Landing config, branding bucket, theme config, knowledge base (`guide_pages`) |
| `0016` | **Module 1**: fiscal entity, `currency_rates`, `sedes`, `tenant_users.sede_ids`, `medical_services`, patient fiscal fields, RBAC helpers |
| `0017` | **Module 2**: `fiscal_counters`, `invoices`, `invoice_items`, `payments`, `credit_notes`, `debit_notes` + RLS |
| `0018` | **Module 3**: `daily_closings`, `doctor_settlements`, `puede_contabilizar` + RLS |
| `0019` | Seed of the fiscal knowledge-base guides (Venezuelan modules) |
| `0020` | Plan normalisation to `INDIVIDUAL` · `PYME` · `PRO` |
| `0021` | Public sign-up: `tenants.reservas_consumidas` / `reservas_gratis_limite` (free-trial counter) + trigger counting every `appointments` insert per tenant |
| `0022` | PyME tier: `max_especialistas` default 10 and PyME quotas normalised into the 2–10 range (no 5 → 10 rewrite of existing clients) |

### Repository layout

```text
medisys/
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                     # marketing landing + demo hub (ISR, revalidate = 300)
│  │  ├─ layout.tsx                   # fonts, global metadata, DemoHubProvider
│  │  ├─ globals.css                  # Tailwind v4 theme tokens (shadcn/base-nova)
│  │  ├─ [clinicSlug]/                # tenant surface
│  │  │  ├─ page.tsx                  # public clinic profile (landing_config + theme_config)
│  │  │  ├─ reservar/page.tsx         # booking wizard entry
│  │  │  ├─ login/page.tsx            # staff login (demo credentials callout)
│  │  │  ├─ admin/                    # dashboard, recepcion, pagos, servicios, especialistas,
│  │  │  │                            # configuracion, facturacion, contabilidad, landing,
│  │  │  │                            # guia, renovar-membresia
│  │  │  ├─ especialista/             # specialist portal (login, dashboard, pacientes/[id])
│  │  │  └─ paciente/                 # patient portal (login, expediente)
│  │  ├─ super-admin/                 # dashboard, nuevo-cliente, pagos, guias, clientes/[id]
│  │  ├─ guias/                       # public help centre (index + [slug])
│  │  ├─ registro/page.tsx            # public sign-up + staff sign-in (?modo=login), same toggle
│  │  ├─ og-image.png/route.tsx       # dynamic Open Graph image (next/og)
│  │  ├─ login/page.tsx               # platform (super-admin) login
│  │  ├─ actions/                     # Server Actions: booking, admin, doctors, tenant, guides,
│  │  │                               # portal-auth + specialist/patient portals,
│  │  │                               # super-admin onboarding/subscription, dashboard,
│  │  │                               # auth (staff sign-in) + registro (public sign-up)
│  │  └─ api/
│  │     ├─ admin/                    # settings, bcv-rate, sedes, services, invoices,
│  │     │                            # closings, settlements, reports/sales-book
│  │     └─ cron/bcv-rate/route.ts    # daily BCV rate job (Authorization: Bearer CRON_SECRET)
│  ├─ components/                     # ui/* primitives (incl. info-popover) + auth/* (login,
│  │                                  # register, plan selector), booking/*, admin/*, super-admin/*,
│  │                                  # portales/*, landing/*, demo/*, guia/*
│  ├─ context/DemoHubContext.tsx      # demo navigation shared state
│  ├─ lib/
│  │  ├─ supabase/                    # server.ts · client.ts · admin.ts (service_role) · storage.ts
│  │  ├─ admin/                       # facturas, contabilidad, libro-ventas, fiscal,
│  │  │                               # servicios, sedes, pacientes, sesion
│  │  ├─ validations/                 # admin · billing · accounting · core (Zod-compatible)
│  │  │                               # + registro (public sign-up)
│  │  ├─ bcv.ts · currency-rates.ts   # rate cascade + multi-currency engine
│  │  ├─ fiscal-ve.ts · billing-ve.ts · accounting-ve.ts   # Venezuelan fiscal rules
│  │  ├─ rbac.ts · staff.ts · super-admin.ts · suscripcion.ts
│  │  ├─ landing.ts · theme.ts · guias-publicas.ts · markdown.ts · bancos.ts
│  │  ├─ date.ts · format.ts · branding.ts · slug.ts · whatsapp.ts · demo.ts
│  │  ├─ trial.ts · telefono.ts · especialidades.ts · site.ts   # public sign-up helpers
│  │  └─ api-admin.ts · api-facturacion.ts · api-contabilidad.ts · api-cliente.ts
│  ├─ types/                          # database.ts (schema) + admin · billing · accounting · booking DTOs
│  └─ proxy.ts                        # Next.js 16 Proxy (route guard for admin/super-admin)
├─ supabase/migrations/               # 0001 … 0020 (idempotent, ordered SQL)
├─ scripts/                           # DDL appliers + demo-data cleanup (plain Node, no framework)
├─ public/                            # static assets (demo logo, icons)
├─ vercel.json                        # Cron: /api/cron/bcv-rate at 12:00 UTC
├─ next.config.ts                     # legacy 301 redirects (/santa-ines → /clinica-demo)
└─ .env.example                       # documented environment variables
```

### Performance & scalability notes

- **One deployable unit**: no backend to scale, no cross-service latency — the API is co-located with the pages that call it.
- **Server-first rendering**: RSC pages fetch through cookie-bound Supabase clients; client bundles stay limited to interactive components (wizard, managers, editors).
- **Targeted revalidation**: mutations call `revalidatePath()` for the affected panel page instead of relying on full graph refreshes; the marketing landing uses ISR (`revalidate = 300`) while authenticated panels are `force-dynamic`.
- **Request-scoped deduplication**: the server Supabase client is wrapped in React `cache()`, so one instance per request is reused.
- **Query-friendly schema**: indexes on the hot paths (`currency_rates` latest-rate lookup, `daily_closings` per tenant/day, partial unique indexes for `fiscal_counters` and closings) and `text + check` enums instead of Postgres enum types, so catalogs evolve without type migrations.
- **Resilience over hard failure**: every external dependency (BCV portal, rate APIs, Storage buckets, optional columns) has a documented fallback, keeping the clinic operational during upstream outages.
- **Tenant isolation at the database layer**: RLS means even a compromised query path cannot read another clinic's rows.

---

## Getting Started

### Prerequisites

| Requirement | Notes |
| --- | --- |
| **Node.js ≥ 20.9** | Required by Next.js 16 (`node -v`) |
| **npm 10+** | `npm`, `yarn`, `pnpm` or `bun` all work; the repository ships `package-lock.json` |
| **Supabase project** | A free or paid project (Postgres + Auth + Storage). You need the Project URL, the `anon` key and the `service_role` key |
| **Supabase CLI** *(optional)* | Only to run `supabase db push` / `supabase migration` instead of pasting SQL |
| **Vercel account** *(optional)* | Required only for production hosting and the daily BCV cron |
| **Postgres connection string or `SUPABASE_ACCESS_TOKEN`** *(optional)* | Required only to run the DDL helper scripts in `scripts/` |

### 1 · Install dependencies

```bash
git clone <repository-url> medisys
cd medisys
npm install
```

### 2 · Configure environment variables

Copy the template and fill in the values:

```bash
cp .env.example .env.local       # macOS / Linux
Copy-Item .env.example .env.local  # Windows PowerShell
```

| Variable | Required | Scope | Purpose |
| --- | :---: | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | browser + server | Supabase project URL (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | browser + server | Public anon key; all access is still constrained by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **server only** | Cron upserts, portal authentication, storage-bucket bootstrap, public help centre reads. Never expose to the browser |
| `CRON_SECRET` | ✅ for cron | server only | Shared secret validated as `Authorization: Bearer <CRON_SECRET>` by `/api/cron/bcv-rate` |
| `PORTAL_SESSION_SECRET` | ⚠️ production | server only | HMAC-SHA256 key that signs the specialist/patient `portal_session` cookie. Development falls back to `medisys-portal-dev-secret` |
| `SAAS_PAGO_MOVIL_BANCO` | ➖ optional | server | Bank label shown to clinics when renewing their subscription (default `Banesco (0134)`) |
| `SAAS_PAGO_MOVIL_CEDULA` | ➖ optional | server | ID/RIF for subscription payments (default `J-40555123-7`) |
| `SAAS_PAGO_MOVIL_TELEFONO` | ➖ optional | server | Phone for subscription payments (default `0414-1234567`) |
| `SAAS_PAGO_MOVIL_TITULAR` | ➖ optional | server | Account holder for subscription payments (default `Medisys C.A.`) |
| `BCV_TLS_ESTRICTO` | ➖ optional | server | Set to `1` to forbid the relaxed-TLS retry used when scraping `bcv.org.ve` |
| `SUPABASE_ACCESS_TOKEN` | ➖ optional | developer machine | Enables DDL execution through the Supabase Management API in `scripts/*.mjs` |
| `DATABASE_URL` | ➖ optional | developer machine | Direct Postgres connection used by the DDL scripts as a second strategy (needs the `pg` driver) |

**`.env.example`**

```dotenv
# ─── Supabase (required) ──────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# Server-only. Grants full database access: never expose it to the browser.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ─── Vercel Cron (required for /api/cron/bcv-rate) ────────────────────────────
# Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CRON_SECRET=replace-with-a-long-random-secret

# ─── Portal sessions (required in production) ─────────────────────────────────
# HMAC-SHA256 key that signs the specialist/patient portal cookie.
PORTAL_SESSION_SECRET=replace-with-a-long-random-secret

# ─── SaaS subscription payment details (optional, shown in the renewal UI) ────
SAAS_PAGO_MOVIL_BANCO="Banesco (0134)"
SAAS_PAGO_MOVIL_CEDULA="J-40555123-7"
SAAS_PAGO_MOVIL_TELEFONO="0414-1234567"
SAAS_PAGO_MOVIL_TITULAR="Medisys C.A."

# ─── Troubleshooting / developer tooling (optional) ──────────────────────────
# Set to 1 to keep strict TLS verification when scraping bcv.org.ve.
# BCV_TLS_ESTRICTO=1
# Supabase Management API token (sbp_...) used by scripts/aplicar-migracion-*.mjs
# SUPABASE_ACCESS_TOKEN=
# Direct Postgres URL used by the same scripts as a fallback strategy
# DATABASE_URL=postgresql://postgres:password@db.your-project-ref.supabase.co:5432/postgres
```

### 3 · Set up the database

> **Important:** the migrations in this repository extend an existing baseline schema. Tables such as `tenants`,
> `profiles`, `doctors`, `schedules` and `appointments` are consumed by every module and documented in
> `src/types/database.ts`, but they are **not** created by `0001…0020`. Create them first (from your existing project
> snapshot or an equivalent baseline DDL) before applying the migrations below.

Apply the migrations in order with whichever route fits your setup:

```bash
# Option A · Supabase CLI
supabase link --project-ref <your-project-ref>
supabase db push

# Option B · SQL Editor: paste supabase/migrations/*.sql in ascending order (they are idempotent)

# Option C · Bundled DDL helper scripts (Node, Development API or direct Postgres)
node scripts/aplicar-migracion-planes.mjs        # migration 0020 · plan normalisation
node scripts/aplicar-migracion-guias.mjs         # migration 0019 · fiscal knowledge-base guides
node scripts/limpiar-logos-demo.mjs              # demo-data cleanup (optional)
```

The application also bootstraps storage buckets it depends on (`branding`, `comprobantes`, `guides`) on first use, so
no manual bucket creation is required.

**Create the first clinic and its administrator**

```sql
-- 1. The tenant (clinic / consultation)
insert into public.tenants (slug, nombre, is_active)
values ('mi-clinica', 'Mi Clínica', true)
returning id;

-- 2. Create the staff user in Supabase Auth (Dashboard → Authentication → Add user,
--    or the Admin API), then attach the membership:
insert into public.tenant_users (tenant_id, user_id, role)
select t.id, '<auth-user-uuid>', 'admin'
from public.tenants t
where t.slug = 'mi-clinica';
```

**Create a platform Super Admin** (access to `/super-admin`):

```sql
-- The Proxy checks user_metadata.role === 'super_admin' and RLS exposes is_super_admin().
update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
  || '{"role":"super_admin"}'::jsonb
where email = 'ops@your-domain.com';
```

### 4 · Run it locally

```bash
npm run dev        # https://localhost:3000
```

Open `http://localhost:3000` for the marketing landing, or jump straight into a tenant surface:

| Surface | URL |
| --- | --- |
| Marketing landing | `http://localhost:3000/` |
| Public clinic profile | `http://localhost:3000/<clinicSlug>` |
| Booking wizard | `http://localhost:3000/<clinicSlug>/reservar` |
| Staff panel | `http://localhost:3000/<clinicSlug>/admin` |
| Staff login | `http://localhost:3000/<clinicSlug>/login` |
| Specialist portal | `http://localhost:3000/<clinicSlug>/especialista` |
| Patient portal | `http://localhost:3000/<clinicSlug>/paciente` |
| Platform console | `http://localhost:3000/super-admin/dashboard` |
| Help centre | `http://localhost:3000/guias` |

The repository ships two demo tenants and their staff/portal credentials in `src/lib/demo.ts`, so a seeded database
lets you click through every flow without creating users:

| | Value |
| --- | --- |
| Multi-specialist clinic | `/clinica-demo` (booking: `/clinica-demo/reservar`) |
| Independent physician | `/medico-pro-demo` |
| Staff sign-in | `demo1@demo.com` · `demo123456` (`src/lib/demo.ts`) |
| Specialist portal | ID `12345678` · phone `04121234567` (`src/lib/demo.ts`) |
| Patient portal | resolved automatically: on demo tenants the portal login fills the first seeded patient that has an ID and a phone |

### 5 · Production build & deployment

```bash
npm run build      # production build (type-checked)
npm run start      # serve the production build locally
npm run lint       # ESLint (core-web-vitals + TypeScript)
```

**Vercel**

1. Import the repository and add every environment variable from `.env.example` to **Production / Preview / Development**.
2. Deploy — `vercel.json` already registers the daily cron (`0 12 * * *` → `/api/cron/bcv-rate`).
3. Make sure `CRON_SECRET` exists in the project, since the endpoint rejects any request without a matching bearer token.

> **Testing:** the project currently has no automated test runner (`npm test` is not defined). Business rules were
> written as pure, side-effect-free functions in `src/lib/*-ve.ts` and `src/lib/date.ts` precisely so a suite can be
> added without refactoring — see the [Roadmap](#roadmap).

---

## Usage Examples

### 1 · Book an appointment (public flow, no account)

```bash
# 1. Share the permanent booking link with your patients
https://medisys.com.ve/mi-clinica/reservar

# 2. Patient flow — all server-validated
#    Step 1  patient: themselves or a dependant/minor
#    Step 2  specialty & specialist (auto-assigned for the INDIVIDUAL plan)
#    Step 3  date + shift (mañana | tarde) → creates the locked appointment (15 min)
#    Step 4  pay online (Pago Móvil reference + receipt)  →  'pendiente_validacion'
#            or pay at reception                          →  'pago_en_recepcion'
# 3. Reception validates the payment, the booking becomes 'confirmada'
#    and the patient can download the receipt PDF / share it on WhatsApp
```

### 2 · Admin API (cookie session, per-tenant)

All endpoints under `/api/admin/*` authenticate through the Supabase session cookie, resolve the caller's membership
in the requested clinic and enforce a granular RBAC permission. Requests accept the clinic either as
`?clinicSlug=<slug>` or as `tenantId` / `clinicSlug` in the JSON body.

| Method & path | Permission | Description |
| --- | --- | --- |
| `GET /api/admin/settings` | `configuracion:leer` | Clinic context (role, permissions, locations) + fiscal profile + live rate |
| `PATCH /api/admin/settings` | `fiscal:escribir` | Update the fiscal entity (Razon social, RIF, domicile, authorised printer…) |
| `GET /api/admin/bcv-rate` | `tasa:leer` | Current rate + history |
| `POST /api/admin/bcv-rate` | `tasa:escribir` | `modo: "auto"` forces a BCV refresh; `modo: "manual"` stores an override |
| `GET · POST /api/admin/sedes` | `sedes:leer` · `sedes:escribir` | List / create locations |
| `PATCH · DELETE /api/admin/sedes/[id]` | `sedes:escribir` | Update / remove a location |
| `GET · POST /api/admin/services` | `servicios:leer` · `servicios:escribir` | Medical service catalog (price USD, taxable, commission) |
| `PATCH · DELETE /api/admin/services/[id]` | `servicios:escribir` | Update / remove a service |
| `GET · POST /api/admin/invoices` | `facturacion:leer` · `facturacion:emitir` | List invoices / issue an invoice (or a draft) |
| `GET /api/admin/invoices/[id]` | `facturacion:leer` | Invoice detail with items and payments |
| `POST /api/admin/invoices/[id]/payments` | `cobros:registrar` | Register a collection (IGTF applied automatically on FX methods) |
| `POST /api/admin/invoices/[id]/cancel` | `facturacion:anular` | Cancel via a linked credit note |
| `GET · POST /api/admin/closings` | `contabilidad:leer` · `contabilidad:escribir` | List / open a daily cash closing |
| `GET · PATCH /api/admin/closings/[id]` | `contabilidad:leer` · `contabilidad:escribir` (auditing: `honorarios:escribir`) | Closing detail with the computed arqueo; close, annotate or audit |
| `GET · POST /api/admin/settlements` | `honorarios:leer` · `honorarios:escribir` | List / generate doctor settlements |
| `PATCH /api/admin/settlements/[id]` | `honorarios:escribir` | Approve or pay a settlement |
| `GET /api/admin/reports/sales-book` | `contabilidad:leer` | SENIAT sales book (`anio`, `mes`, `sedeId`, `formato=json\|csv`) |

**Response contract**

```jsonc
// success
{ "ok": true, "data": { /* payload */ } }

// failure — the HTTP status is derived from `code`
// UNAUTHENTICATED → 401 · FORBIDDEN → 403 · NOT_FOUND → 404 · CONFLICT → 409
// INVALID_INPUT → 422 · MIGRACION_PENDIENTE → 503 · SERVER_ERROR → 500
{
  "ok": false,
  "code": "INVALID_INPUT",
  "message": "La tasa debe ser mayor a 0.",
  "issues": [{ "campo": "rate", "mensaje": "La tasa debe ser mayor a 0." }]
}
```

**Examples**

```bash
# Current clinic context + fiscal profile + live BCV rate
curl -s "http://localhost:3000/api/admin/settings?clinicSlug=clinica-demo" \
  -H "Cookie: <supabase-session-cookies>"

# Force an official BCV refresh, then pin a manual rate for the day
curl -s -X POST "http://localhost:3000/api/admin/bcv-rate" \
  -H "Content-Type: application/json" -H "Cookie: <supabase-session-cookies>" \
  -d '{"clinicSlug":"clinica-demo","modo":"auto"}'

curl -s -X POST "http://localhost:3000/api/admin/bcv-rate" \
  -H "Content-Type: application/json" -H "Cookie: <supabase-session-cookies>" \
  -d '{"clinicSlug":"clinica-demo","modo":"manual","tasa":{"currency":"USD","rate":41.25,"effectiveDate":"2026-09-19"}}'

# Issue a SENIAT-ready invoice: 1 exempt direct-medical line, collected on the spot,
# BCV rate resolved by the engine (or forced through "bcvRate": 41.25).
curl -s -X POST "http://localhost:3000/api/admin/invoices" \
  -H "Content-Type: application/json" -H "Cookie: <supabase-session-cookies>" \
  -d '{
        "clinicSlug": "clinica-demo",
        "factura": {
          "sedeId": null,
          "patientId": null,
          "appointmentId": null,
          "fiscalProfile": {
            "tipoDocumento": "V",
            "documentoIdentidad": "V-12345678",
            "razonSocial": "María Pérez",
            "direccionFiscal": "Av. Libertador, Caracas",
            "email": "maria@example.com",
            "telefono": "04141234567",
            "pacienteNombre": "María Pérez"
          },
          "items": [
            { "serviceId": null, "description": "Consulta de cardiología",
              "quantity": 1, "unitPriceUSD": 30, "taxable": false, "doctorId": null }
          ],
          "bcvRate": null,
          "emitir": true,
          "notas": null,
          "cobro": { "method": "PAGO_MOVIL", "amountUSD": null, "amountVES": 1237.5,
                     "referenceNumber": "004512", "notes": null, "verificar": true }
        }
      }'

# SENIAT sales book for September 2026 as a downloadable CSV
curl -s -o libro-ventas-2026-09.csv \
  "http://localhost:3000/api/admin/reports/sales-book?clinicSlug=clinica-demo&anio=2026&mes=9&formato=csv" \
  -H "Cookie: <supabase-session-cookies>"
```

### 3 · Daily BCV rate job

```bash
# Production (Vercel Cron does this automatically every day at 12:00 UTC)
curl -s "https://medisys.com.ve/api/cron/bcv-rate" \
  -H "Authorization: Bearer $CRON_SECRET"
# → { "ok": true, "registro": { … }, "fuente": "bcv-web", "detalle": "bcv.org.ve (#usd)" }
```

### 4 · Reusing the domain engines in your own code

```ts
// Multi-currency: resolve the rate in force, then convert
import { getTasaVigente, convertirMoneda } from "@/lib/currency-rates"
import { TASA_BCV_FALLBACK } from "@/lib/bcv"

const tasa = await getTasaVigente(supabase)      // origen: "manual" | "bcv" | "respaldo"
const totalVES = convertirMoneda(120, "USD", "VES", tasa.rate)

// Fiscal rules (pure functions, safe in client components)
import {
  calcularTotalServicio,   // IVA 16% on taxable, 0% on exempt + rounding
  calcularHonorarioMedico, // PERCENTAGE | FIXED, never above the service price
  normalizarRif,           // "j40724077 3" → "J-40724077-3"
  formatearDocumentoIdentidad,
} from "@/lib/fiscal-ve"

const { subtotal, iva, total } = calcularTotalServicio(45, /* taxable */ false)
const honorario = calcularHonorarioMedico(45, "PERCENTAGE", 60)   // → 27

// Billing engine: IGTF per collection method + invoice totals in both currencies
import {
  ALICUOTA_IGTF, METODO_COBRO_INFO, calcularIgtf, desglosarCobro, calcularTotalesFactura,
} from "@/lib/billing-ve"

const info = METODO_COBRO_INFO.ZELLE      // { moneda: "USD", aplicaIgtf: true, … }
const igtf = calcularIgtf(100)            // → 3

// Accounting engine: SENIAT sales book, cash reconciliation, settlements
import {
  construirLibroVentas, resumirLibroVentas, libroVentasACSV,
  calcularArqueo, liquidarHonorarios,
} from "@/lib/accounting-ve"

const filas = construirLibroVentas(facturas)              // one row per operation, SENIAT column order
const resumen = resumirLibroVentas(filas, tasaVigente)    // monthly consolidation (IVA + IGTF)
const reporte: LibroVentasReporte = {
  anio: 2026, mes: 9, desde: "2026-09-01", hasta: "2026-09-30",
  generadoEn: new Date().toISOString(), tasaReferencia: tasaVigente,
  filas, resumen,
}
const csv = libroVentasACSV(reporte)                      // ready for Excel / Google Sheets
```

### 5 · RBAC checks in server code

```ts
import { resolverContextoAdmin, responder } from "@/lib/admin/sesion"
import { tienePermiso } from "@/lib/rbac"

// Inside a Route Handler
const contexto = await resolverContextoAdmin({
  clinicSlug, tenantId, permiso: "facturacion:emitir",
})
if (!contexto.ok) return responder(contexto)          // → 401 / 403 automatically

const { supabase, staff } = contexto.data
if (!tienePermiso(staff.role, "facturacion:anular")) {
  return responder({ ok: false, code: "FORBIDDEN", message: "Tu rol no permite anular facturas." })
}
```

### 6 · Applying a DDL migration from the CLI

```bash
# Uses SUPABASE_ACCESS_TOKEN (Management API) with DATABASE_URL as a second strategy
node scripts/aplicar-migracion-planes.mjs
node scripts/aplicar-migracion-planes.mjs --token=sbp_xxxxxxxx
node scripts/aplicar-migracion-planes.mjs --instalar-driver   # installs `pg` for the Postgres path
```

---

## Roadmap

The application is intentionally built so that new capacity, automation and intelligence layers can land **without
touching the fiscal core**. Items below are grouped by theme and ordered by expected impact.

### Product depth

- [ ] **Configurable capacity per shift** — wire `tenants.max_slots_per_shift` into `lockAppointmentSlot` (the TODO in `src/app/actions/booking.ts` already marks the extension point), with per-specialist overrides.
- [ ] **Automatic lock janitor** — a cron that flips stale `pendiente` appointments to `expirada` so the agenda never shows ghosts.
- [ ] **Automated Pago Móvil reconciliation** — SMS-gateway ingestion (already documented in the knowledge base) to match incoming bank messages against pending references and auto-confirm payments.
- [ ] **WhatsApp Business Cloud API** — templated confirmations and reminders as the official channel, replacing the current `wa.me` deep links.
- [ ] **Telemedicine** — video-consultation links and virtual shifts on top of the existing `telemedicina` badge in the public profile.
- [ ] **Deeper clinical record** — printable/locked consultation notes, prescriptions, lab attachments and consent forms.

### Fiscal & accounting

- [ ] **Electronic invoicing (facturación digital SENIAT)** — signed XML/PDF export and integration with the tax administration's digital channels.
- [ ] **Additional fiscal reports** — purchase book, retention book and IVA/IGTF declarations ready for monthly filing.
- [ ] **Fiscal-number ranges per machine/series** — multiple `fiscal_counters` series for practices printing from several cash desks.
- [ ] **Bank reconciliation import** — CSV/OFX statement uploads matched against `payments` to speed up daily closings.

### AI & automation (not present today)

- [ ] **Assistive triage & specialty routing** — suggest the right specialist/service from the patient's free-text reason for visit, always human-confirmed.
- [ ] **No-show risk scoring** — features from booking lead time, shift, history and validation latency, used to prioritise reminder calls (deterministic baseline first, model second).
- [ ] **Drafting assistance for clinical notes and fiscal descriptions** — generated server-side and never auto-saved without specialist review.
- [ ] **Semantic search over the knowledge base and patient records** — an embedding index over `guide_pages` plus record lookup, replacing plain substring matching.
- [ ] **Anomaly detection in cash closings** — flag recurring shortfalls per cashier and collection method for the auditor.
- [ ] **Provider-agnostic AI layer** — one internal interface (OpenAI / Anthropic / local models) with per-tenant opt-in, audit logging and PII redaction before any external call.

### Engineering, quality & ops

- [ ] **Automated test suite** — Vitest unit tests for the pure engines (`fiscal-ve`, `billing-ve`, `accounting-ve`, `date`, `bcv`, `rbac`) plus Playwright end-to-end coverage for booking → validation → invoice → closing. No runner is configured today.
- [ ] **CI pipeline** — type-check, lint, tests and a migration dry-run gate on every pull request.
- [ ] **Adopt Zod** — the validation layer already mirrors Zod's API (`safeParse` / `parse` / `issues`), so the swap is a single-module change.
- [ ] **Observability** — structured logging, error tracking (e.g. Sentry) and alerts on BCV-cron failures and payment-verification backlog.
- [ ] **Rate limiting & abuse protection** on the public booking endpoints (`lockAppointmentSlot`, receipt upload).
- [ ] **Internationalisation** — extract UI strings to catalogs and ship `en-US` alongside `es-VE`.
- [ ] **Accessibility & performance budgets** — automated axe checks and bundle-size regression gates.
- [ ] **Multi-currency expansion** — extend `CurrencyCode` beyond `USD`/`VES`; the rate engine, storage and UI already generalise well.

---

## License & Credits

**Proprietary software.** There is no open-source licence file in this repository: the source code, database schema,
documentation and brand are the confidential property of the rights holder, and no right of use, reproduction,
modification or distribution is granted unless agreed in writing.

| | |
| --- | --- |
| **Legal entity** | Centro Iberoamericano de Artes Digitales — IBEARTS, C.A. · RIF `J-40724077-3` |
| **Engineering** | Vortex Logic Microsystems · <https://vortex.com.ve> |
| **Sales & onboarding** | `ventas@vortex.com.ve` · WhatsApp [+58 424-2810101](https://wa.me/584228101010) |
| **Product domain** | <https://medisys.com.ve> |

Built with [Next.js](https://nextjs.org), [React](https://react.dev), [Tailwind CSS](https://tailwindcss.com),
[shadcn/ui](https://ui.shadcn.com), [Supabase](https://supabase.com) and [Vercel](https://vercel.com).

<sub>Medisys is a Venezuelan product: IVA/IGTF handling, RIF validation, Pago Móvil reconciliation, the SENIAT sales
book and the official BCV rate are first-class requirements of the domain — not plugins.</sub>

