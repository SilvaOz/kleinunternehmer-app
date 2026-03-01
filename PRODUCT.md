# InvoiceOS — Producto Completo

> **Herramienta de facturación, gastos y contabilidad para autónomos alemanes (Kleinunternehmer §19 UStG)**
> Construida con Next.js 15 · MongoDB · React PDF · XRechnung 3.0 · TypeScript

---

## ¿Qué es InvoiceOS?

InvoiceOS es una aplicación web SaaS completa que permite a los autónomos alemanes que operan bajo la figura de **Kleinunternehmer** (§19 UStG — sin IVA) gestionar toda su actividad económica en un único lugar:

- Crear y emitir facturas numeradas automáticamente
- Descargar PDFs de factura con diseño profesional
- Generar archivos **XRechnung** (estándar XML del gobierno alemán para la facturación electrónica)
- Registrar y categorizar gastos de negocio
- Generar informes financieros y el **EÜR** (Einnahmen-Überschuss-Rechnung) para Hacienda
- Gestionar la cartera de clientes

La interfaz está completamente en **alemán** y cumple con los requisitos legales y fiscales del mercado alemán.

---

## Mercado objetivo

| Segmento | Descripción |
|----------|-------------|
| **Freiberufler** | Programadores, diseñadores, consultores, traductores |
| **Therapeuten / Ärzte** | Fisioterapeutas, psicólogos, coaches con facturación privada |
| **Kreative** | Fotógrafos, videógrafos, músicos, artistas |
| **Handwerker** | Pequeños talleres con facturación sin IVA |
| **Soloselbstständige** | Cualquier autónomo alemán con régimen §19 UStG |

En Alemania hay más de **4,5 millones de autónomos** (Selbstständige), de los cuales una parte significativa opera bajo §19 UStG. Es un mercado con demanda real y recurrente.

---

## Funcionalidades principales

### Gestión de Facturas

- **Creación de borradores**: añade ítems con título, descripción (líneas), cantidad y precio unitario
- **Numeración automática** por año: formato `YYYY-NNNN` (2026-0001, 2026-0002…), atómica y sin huecos
- **Emisión de facturas**: al emitir, la factura se bloquea, se asigna número definitivo y se congela el snapshot del cliente
- **Marcado como pagada**: registro de la fecha de cobro
- **Facturas de cancelación (Storno)**: genera una factura de corrección con ítems negativos, manteniendo el historial completo
- **Filtros y búsqueda**: por estado (borrador / emitida / pagada / cancelada), año y texto libre
- **Descarga PDF**: un clic, generado en el servidor con diseño profesional
- **Descarga XRechnung**: XML conforme a UBL 2.1 + EN 16931 + XRechnung 3.0 CIUS

### PDF Profesional

El PDF generado incluye:
- Cabecera navy con nombre de empresa, número y fecha de factura
- Datos del emisor (dirección, email, teléfono, Steuernummer)
- Datos del receptor (snapshot del cliente en el momento de emisión)
- Tabla de ítems con cantidad, precio unitario y total
- Subtotal y Gesamtbetrag (total en caja con alto contraste)
- Bloque de pago: Kontoinhaber (titular real), IBAN, BIC, Bankname
- Aviso legal §19 UStG personalizable
- Pie de página personalizable
- Identificación visual: facturas en lima (#c8f04a), Storno en rosa (#f04a8c)

### XRechnung / E-Invoice

- Formato: **UBL 2.1** (Universal Business Language)
- Estándar: **EN 16931-1:2017** (norma europea de factura electrónica)
- Perfil: **XRechnung 3.0 CIUS** (estándar del gobierno alemán)
- IVA: 0 % tipo "E" (Exempt) para Kleinunternehmer
- Validado con **KoSIT Validator**: 0 errores, solo aviso BR-DE-21 (no crítico, el validador recomienda aceptar el documento)
- Obligatorio para facturar a la administración pública alemana (B2G)

### Gestión de Gastos

- Registro de gastos por fecha, proveedor, descripción, importe bruto
- **8 categorías**: Software, Hardware, Oficina, Formación, Viajes, Hosting, Servicios, Otros
- **Porcentaje de uso profesional** (businessUsePct): si un gasto es 50 % profesional, solo cuenta ese 50 % en el EÜR — el cálculo es automático
- Marcado de pagado/pendiente con fecha de pago
- Metadatos de recibo (URL + hash SHA256 para integridad)
- Filtros por año, categoría y estado de pago

### Gestión de Clientes

- Alta de clientes con empresa y/o nombre de contacto (ambos opcionales individualmente)
- Dirección completa (calle, CP, ciudad, país)
- Email, teléfono, notas libres
- Borrado suave (soft-delete: se marca como inactivo, no se elimina)
- Estadísticas por cliente: ingresos totales, número de facturas, última factura
- Búsqueda en tiempo real

### Informes y Exportación

| Informe | Descripción |
|---------|-------------|
| **Dashboard KPIs** | Ingresos pagados YTD, gastos de negocio YTD, beneficio (EÜR), facturas pendientes de cobro |
| **Desglose mensual** | Gráfico de ingresos vs. gastos por cada uno de los 12 meses |
| **Comparativa anual** | % de cambio en ingresos respecto al año anterior |
| **EÜR CSV** | Resumen mensual para declaración de Hacienda |
| **Export facturas CSV** | Lista de facturas pagadas del año (fecha, número, cliente, total) |
| **Export gastos CSV** | Gastos detallados con uso profesional calculado |

**Formato CSV**: separador de punto y coma, UTF-8 con BOM — compatible con Excel en locale alemán.

### Configuración y Cuenta

- Datos de empresa: nombre, dirección, teléfono, email, Steuernummer
- **Bankverbindung**: Kontoinhaber (nombre real del titular, requerido por SEPA), IBAN, BIC, Bankname
- Modo de IVA: Kleinunternehmer (§19 UStG) o Umsatzsteuerpflichtig
- Cambio de contraseña con verificación de contraseña actual
- Eliminación de cuenta con confirmación por email (elimina todos los datos en cascada)
- Textos personalizables: aviso §19 UStG y pie de factura (vía variables de entorno)

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| **Framework** | Next.js (App Router) | 15.5.12 |
| **UI** | React | 19.2.4 |
| **Lenguaje** | TypeScript | 5.5.2 |
| **Base de datos** | MongoDB + Mongoose | 8.4.1 |
| **Autenticación** | JWT (jose) + bcryptjs | jose 5.9.3 · bcrypt 12 rounds |
| **PDF** | @react-pdf/renderer | 4.3.2 |
| **Validación** | Zod | 3.23.8 |
| **Estilos** | Tailwind CSS + CSS Modules | 4.2.1 |
| **Tipografía** | DM Serif Display (Google Fonts) | — |
| **Hosting** | Vercel / Node.js compatible | — |

---

## Arquitectura

```
src/
├── app/
│   ├── (auth)/           → Páginas públicas: /login, /register
│   ├── (dashboard)/      → Páginas protegidas: /, /invoices, /expenses,
│   │                         /clients, /reports, /settings
│   └── api/
│       ├── auth/         → register, login, logout, me, account, password
│       ├── clients/      → CRUD de clientes
│       ├── invoices/     → CRUD + issue + pay + storno + pdf + xrechnung
│       ├── expenses/     → CRUD de gastos
│       └── reports/      → summary + export (CSV)
│
├── models/               → Mongoose schemas: User, Client, Invoice, Expense, Counter
├── lib/                  → auth (JWT+cookies), validations (Zod), db (MongoDB), formatters
└── services/
    └── pdf/              → InvoicePDF.tsx (react-pdf renderer)
```

### Seguridad

- Sesión via cookie **httpOnly** (inaccesible desde JS del cliente → protección XSS)
- JWT HS256 firmado con `JWT_SECRET` (no expuesto al cliente nunca)
- Contraseñas hasheadas con **bcrypt 12 rounds**
- `SameSite=lax` en cookies (protección CSRF)
- Todas las rutas API verifican `ownerId` — **multi-tenant completamente aislado**
- Validación Zod en todos los endpoints (nunca se confía en el body del cliente)
- Whitelist estricta de campos actualizables en PUT (no se puede inyectar campos arbitrarios)

### Multi-tenancy

Cada registro (factura, gasto, cliente) está vinculado a `ownerId`. Ningún usuario puede acceder a datos de otro. La cuenta se puede borrar en cascada con una sola operación.

---

## Modelos de datos

### User
```typescript
email (único) · passwordHash · vatMode · vatRate
company: { name · street · zip · city · country · email · phone
           taxNumber · iban · bic · bankName · accountHolder }
isActive · createdAt · updatedAt
```

### Invoice
```typescript
ownerId · year · sequence · invoiceNumber (YYYY-NNNN)
status: draft | issued | paid | canceled
issuedAt · dueAt · paidAt · locked
clientId · clientSnapshot (snapshot de cliente al emitir)
items[]: { title · lines[] · qty · unitPrice }
currency · subtotal · total (auto-calculado)
kleinunternehmerText · footerText
stornoOf · stornoId (referencias cruzadas Storno)
```

### Expense
```typescript
ownerId · date · vendor · description
category: software|hardware|office|training|travel|hosting|services|other
amountGross · businessUsePct (0–100) · paid · paidAt
receipt: { url · sha256 } · notes
[virtual] amountBusiness = amountGross × (businessUsePct / 100)
```

### Client
```typescript
ownerId · companyName · contactName (al menos uno requerido)
street · zip · city · country · email · phone · notes
isActive (soft-delete)
```

### Counter
```typescript
ownerId · year · sequence (auto-incremental atómico)
— garantiza numeración sin huecos y sin condiciones de carrera
```

---

## Variables de entorno necesarias

```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=una-clave-muy-larga-y-aleatoria
JWT_EXPIRES_IN=8h

# Opcionales (tienen defaults razonables)
INVOICE_KLEINUNTERNEHMER_TEXT="Gemäß §19 UStG wird keine Umsatzsteuer berechnet."
INVOICE_FOOTER_TEXT="Vielen Dank für Ihren Auftrag."
INVOICE_DEFAULT_DUE_DAYS=14
```

---

## Flujo completo de una factura

```
1. Crear borrador (POST /api/invoices)
   → items, clientId opcional, dueAt opcional

2. Editar borrador (PUT /api/invoices/[id])
   → Sólo posible si status=draft y locked=false

3. Emitir factura (POST /api/invoices/[id]/issue)
   → Asigna número YYYY-NNNN (Counter atómico)
   → Congela clientSnapshot
   → locked = true, status = "issued"

4a. Marcar como pagada (POST /api/invoices/[id]/pay)
    → status = "paid", paidAt = now

4b. Crear Storno (POST /api/invoices/[id]/storno)
    → Nueva factura con ítems negativos
    → Original: stornoId apunta a la nueva
    → Nueva: stornoOf apunta a la original

5. Descargar PDF (GET /api/invoices/[id]/pdf)
   → Generado on-demand en el servidor
   → Sólo disponible para status ≠ draft

6. Descargar XRechnung (GET /api/invoices/[id]/xrechnung)
   → XML UBL 2.1 / EN 16931 / XRechnung 3.0
   → Sólo disponible para status ≠ draft
```

---

## Qué lo diferencia de la competencia

| Característica | InvoiceOS | Lexoffice | Sevdesk | FastBill |
|----------------|-----------|-----------|---------|----------|
| Precio | Own deployment / SaaS pricing libre | €6–18/mes | €8–20/mes | €9–20/mes |
| XRechnung | ✅ Incluido | ✅ Plan Pro | ✅ Plan Pro | ❌ |
| EÜR Export | ✅ Incluido | ✅ | ✅ | ✅ |
| Open Source / White-label | ✅ Totalmente | ❌ | ❌ | ❌ |
| DSGVO (datos propios) | ✅ Tu propio servidor | ❌ Nube externa | ❌ Nube externa | ❌ Nube externa |
| Storno automático | ✅ | ✅ | ✅ | ✅ |
| Sin tracking ni anuncios | ✅ | ❌ | ❌ | ❌ |
| Multi-idioma fácil | ✅ (código limpio) | ❌ | ❌ | ❌ |

---

## Modelos de negocio posibles

### 1. SaaS (Software as a Service)
- Free plan: hasta 5 facturas/mes
- Pro plan: facturas ilimitadas + XRechnung + EÜR export → 9–15 €/mes
- Business: multi-usuario, API access → 25 €/mes

### 2. Venta de código fuente (Source code sale)
- Venta única del repositorio completo
- Incluye: todos los modelos, rutas API, UI, PDF, XRechnung
- Precio sugerido: 500–2.000 € según el comprador

### 3. White-label para contables / steuerberater
- Adaptación con su marca
- Contable lo ofrece a sus clientes como herramienta propia

### 4. Marketplace (Gumroad / Lemon Squeezy)
- Plantilla / boilerplate de Next.js + MongoDB + facturación
- Precio: 79–199 € como starter kit para developers

---

## Estado actual del producto

| Componente | Estado |
|------------|--------|
| Autenticación completa | ✅ Producción |
| CRUD Facturas | ✅ Producción |
| CRUD Gastos | ✅ Producción |
| CRUD Clientes | ✅ Producción |
| PDF profesional | ✅ Producción |
| XRechnung (validado KoSIT) | ✅ Producción |
| EÜR + CSV Export | ✅ Producción |
| Dashboard con KPIs | ✅ Producción |
| Storno invoices | ✅ Producción |
| Settings completos | ✅ Producción |
| Login redesñado | ✅ Producción |
| Multi-tenant seguro | ✅ Producción |
| Responsive móvil | ⚠️ Parcial (desktop-first) |
| Tests automatizados | ⚠️ Script PowerShell (integration) |
| Dark mode only | ✅ (diseño dark premium) |

---

## Capturas de pantalla (para portfolio)

_Añadir screenshots de:_

1. **Login page** — split layout con InvoiceOS logo, "Einfach gemacht." en cursiva lima
2. **Dashboard** — KPI cards + gráfico mensual
3. **Listado de facturas** — filtros, estados con colores
4. **Detalle de factura** — ítems, botones emitir/PDF/XRechnung
5. **PDF generado** — diseño navy + lima
6. **Gastos** — formulario inline con categorías
7. **Informes** — desglose mensual + export
8. **Einstellungen** — formulario completo con Bankverbindung

---

## Para el portfolio técnico

**Habilidades demostradas:**

- **Next.js 15 App Router** con Server Components, Route Handlers, middleware de autenticación
- **MongoDB / Mongoose** con esquemas complejos, índices, hooks pre-save, operaciones atómicas (Counter)
- **JWT + httpOnly cookies** — auth segura sin librerías de terceros como NextAuth
- **Zod validation** — validación runtime en TypeScript, mensajes en alemán
- **react-pdf/renderer** — generación de PDF complejos en servidor con estilos y layout profesional
- **XRechnung / UBL 2.1** — implementación de estándar europeo de facturación electrónica (EN 16931)
- **Multi-tenant SaaS** — aislamiento completo de datos por usuario
- **TypeScript estricto** — tipado end-to-end desde modelos hasta API responses
- **CSS Modules + Tailwind** — estilos organizados, sin conflictos
- **DM Serif Display (Google Fonts)** — tipografía serif italiana para UI premium
- **Internacionalización implícita** — UI alemana, fechas localizadas, CSV en locale DE

---

## Construido por

**Oscar** — Desarrollador fullstack · Especialidad en productos SaaS B2B para mercados europeos

> *"Esto empezó como un MVP para uso personal. Terminó siendo un producto completo, seguro, con estándar gubernamental europeo implementado y validado. Listo para vender."*

---

*Última actualización: marzo 2026*
