# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Dfly-app — Reglas principales del proyecto

@AGENTS.md

## Estado actual

App de delivery para **Otavalo (Ecuador)**: USD en centavos, celulares +593. Categorías: Restaurantes, Market, Farmacia, Licores y Mascotas. Flujo de pedidos: cliente → WhatsApp del dueño (datos completos) → comercio (solo productos, botones Aceptar/Rechazar) → confirmación al dueño y al cliente. Vía WhatsApp Cloud API con patrón outbox. Contexto de producto en `PRODUCT.md`; diseño de referencia en `Dfly Home v2.dc.html`.

Hecho: auth (email + contraseña, verificación de correo y celular por código, recuperación de contraseña), catálogo, carrito, checkout, pedidos con estado en vivo, perfil, y mensajería (builders, outbox con reintentos, webhook firmado, crons). Sin credenciales de Meta, los mensajes se registran en la consola del servidor (`[whatsapp:dev]`). Backoffice en `/admin` (resumen del día, pedidos con cancelar/reintentar mensajes, comercios y productos). Catálogo real de restaurantes en `prisma/data/catalogo-otavalo.ts` (6 comercios con menú; `Store.whatsappPhone` es obligatorio porque ahí llegan los pedidos, así que los restaurantes del directorio quedan en `pendingStores` hasta tener número). El admin sube fotos de comercios y productos y define acompañantes/extras por producto. Pendiente: proyecto de Supabase para las fotos en producción, WhatsApp y menú de esos restaurantes, comercios de Market/Farmacia/Licores/Mascotas (hoy solo los ficticios del seed).

## Comandos

| Tarea | Comando |
|---|---|
| Desarrollo | `npm run dev` |
| Build | `npm run build` |
| Lint / tipos | `npm run lint` · `npm run typecheck` |
| Tests (Vitest) | `npm test` · un archivo: `npx vitest run src/modules/ordering/domain.test.ts` · por nombre: `npx vitest run -t "<texto>"` |
| Generar cliente Prisma | `npm run db:generate` (requiere `DIRECT_URL` en `.env`) |
| Nueva migración (local) | `npm run db:migrate -- --name <nombre>` |
| Migraciones (producción) | `npm run db:deploy` |
| Seed | `npm run db:seed` |
| Importar catálogo real (idempotente) | `npm run db:import-catalog` |
| Explorar datos | `npm run db:studio` |

Versiones: Next.js 16.3, React 19.2, Auth.js 5 beta, Prisma 7, Zod 4, Tailwind CSS 4, Zustand 5.

Notas: `postinstall` ejecuta `prisma generate`. El cliente Prisma (v7, `prisma-client` + `@prisma/adapter-pg`) se genera en `src/generated/prisma` (ignorado por git) y se importa desde `@/generated/prisma/client`; los enums desde `@/generated/prisma/enums`. La app conecta con `DATABASE_URL` (puede ir por pooler); el CLI (`prisma.config.ts`) usa `DIRECT_URL`. Los tests son unitarios puros (`src/**/*.test.ts`), sin base de datos. npm 12 bloquea los scripts de instalación, por eso se usa `bcryptjs`. `src/proxy.ts` debe exportar la función por defecto (no sirve una exportación desestructurada).

## Configuración de Claude en el repo

- `.claude/rules/` — reglas detalladas por capa (`nextjs.md`, `database.md`, `auth.md`); son normativas y amplían este archivo.
- `.claude/agents/frontend-builder.md` — subagente para trabajo de UI (páginas, componentes, diseño, animación). Solo usa las skills del proyecto: `impeccable`, `design-taste-frontend` y `animate`.
- `.claude/agents/007jarvis.md` (007Jarvis) — subagente de solo lectura que revisa la app de extremo a extremo (flujo de pedido, seguridad del login, pago y BD) y entrega un informe por severidad.
- `.claude/skills/` — skills de diseño y `ucp` (Universal Commerce Protocol, de `vercel-labs/agentic-commerce-skills`) instaladas desde GitHub (versiones fijadas en `skills-lock.json`); no editarlas a mano.

Estas reglas definen el stack base. Toda decisión técnica nueva debe respetarlas; si algo requiere desviarse, se propone y se justifica antes de implementarlo.

## Stack obligatorio

| Capa | Tecnología | Detalle |
|---|---|---|
| Framework | **Next.js** (App Router) + TypeScript | Ver `.claude/rules/nextjs.md` |
| Base de datos | **PostgreSQL** | Acceso vía Prisma ORM. Ver `.claude/rules/database.md` |
| Autenticación | **Auth.js (NextAuth.js v5)** | Login dual: credenciales + OAuth. Ver `.claude/rules/auth.md` |

## Principios generales

- TypeScript en modo `strict`. Nada de `any` salvo justificación explícita.
- Server Components por defecto; `"use client"` solo cuando haga falta interactividad.
- Toda entrada de usuario (formularios, Server Actions, Route Handlers) se valida con **Zod** en el servidor.
- Secretos únicamente en variables de entorno (`.env`, ignorado por git; Prisma lo lee vía `dotenv`). Mantener `.env.example` actualizado.
- Alias de imports: `@/` apunta a la raíz de `src/`.
- Antes de usar APIs de Next.js, Prisma o Auth.js, consultar la documentación actual (Context7): cambian entre versiones.

## Arquitectura

La lógica de negocio vive en `src/modules/<dominio>/` (`identity`, `catalog`, `ordering`, `messaging`, `admin`); `src/app` solo compone páginas y Route Handlers y no importa `@/lib/db` (las lecturas van en `<dominio>/queries.ts`). Dependencias en un solo sentido: `admin → ordering/identity/catalog`, `ordering → catalog/messaging`; `messaging` es infraestructura (builders, transporte, outbox) y no conoce las reglas del pedido; `identity` solo usa `messaging/auth-code.ts` para enviar el código del celular. Utilidades compartidas en `lib` (`money.ts#formatUsd`, `codes.ts#generateCode`). En `identity`, las Server Actions están separadas por tema (`auth-`, `profile-`, `email-`, `phone-`, `password-actions.ts`) y no acceden a Prisma: usan `accounts.ts`, `queries.ts` y los servicios de verificación. Los archivos de servidor llevan `import "server-only"`; `domain.ts` y los builders de mensajes son puros para poder testearlos.

**Ciclo de un pedido** (`OrderStatus`: `PENDING → SENT_TO_STORE → ACCEPTED | REJECTED | EXPIRED`, más `CANCELLED`):
1. `ordering/actions.ts#createOrderAction` valida con Zod, **recalcula precios desde la BD** y, en una sola transacción, crea el pedido y encola dos mensajes: `ADMIN_NEW_ORDER` (datos completos al dueño) y `STORE_REQUEST` (solo productos y notas saneadas al comercio; nunca datos del cliente). Luego dispara el envío con `after()`.
2. `ordering/dispatch.ts#dispatchOrderMessages` es la única entrada para despachar: llama a `messaging/outbox.ts#dispatchOutbox` (reserva optimista con `attempts` como versión, backoff exponencial, máx. 5 intentos) con un `onSent` obligatorio que corre en la transacción que marca el mensaje `SENT`: al enviarse `STORE_REQUEST`, el pedido pasa a `SENT_TO_STORE` (o se avisa al comercio si se canceló mientras salía). Es seguro correrlo en paralelo (`after()` + cron). **Pedidos largos**: Meta limita a 1024 caracteres el cuerpo de una plantilla, así que si `ADMIN_NEW_ORDER` o `STORE_REQUEST` no caben, el builder (`messages.ts#fitOrderBody`) pone el resto en `continuation` (plantilla `pedido_detalle_parte`; nunca trunca). El outbox los envía como un único envío y guarda el progreso en `OutboxMessage.partsSent` para retomar sin repetir; `onSent` corre con el **primer** mensaje (el de los botones), y cancelar o expirar marca `SKIPPED` lo que falte. Si hicieran falta más de `MAX_CONTINUATION_PARTS` (9), el checkout pide dividir el pedido.
3. Los botones del comercio llevan un payload firmado con HMAC (`messaging/action-payload.ts`, `ORDER_ACTION_SECRET`). El webhook (`api/webhooks/whatsapp`) verifica la firma de Meta y llama a `ordering/store-response.ts#applyStoreResponse`, que exige que el remitente sea el número del comercio y registra `WebhookEvent.waMessageId` en la misma transacción que el cambio de estado (así un fallo no deja el evento marcado). Si alguna pulsación falla, el webhook responde 500 para que Meta reintente.
4. Crons (`api/cron/outbox`, `api/cron/expire-orders`, autenticados con `Bearer CRON_SECRET` vía `lib/cron-auth.ts`): reintentos del outbox y expiración de pedidos sin respuesta tras `ORDER_RESPONSE_TIMEOUT_MIN` (5 min por defecto); al expirar se avisa al dueño (`ADMIN_EXPIRED`) y al comercio para que no lo prepare (`STORE_LATE_RESPONSE`). Si el comercio pulsa con el pedido ya `EXPIRED` o `CANCELLED`, `applyStoreResponse` devuelve `late-noticed` y encola, una sola vez por pedido, el aviso al comercio (si aún no lo tuvo) y `ADMIN_LATE_RESPONSE` al dueño. Se despliega en Vercel Pro: `vercel.json` los programa cada minuto y Vercel envía el `Bearer` solo si `CRON_SECRET` está en las variables del proyecto (el plan Hobby no admite crons de más de una vez al día).

Invariantes:
- Todo cambio de estado pasa por `ordering/transitions.ts#transitionOrder`: valida contra la tabla de `domain.ts`, hace `updateMany` condicionado al estado actual (gana la primera respuesta) y registra un `OrderStatusEvent`.
- Todo mensaje saliente se encola con `enqueue(tx, ...)` **dentro de la misma transacción** que el cambio de estado; nunca se llama al transporte directamente.
- `Store.whatsappPhone` y los datos del cliente (`customerName/Phone`, `deliveryAddress`, snapshot en `Order`) nunca llegan al comercio ni al navegador ajeno.
- `messaging/transport.ts` usa la Cloud API si hay credenciales; si no, `DevLogTransport`. Los mensajes son plantillas de Meta (`template` + `bodyParams` + `quickReplies`).

**Verificación de la cuenta (una sola vez)**: login solo con email + contraseña (sin Google). El registro no revela si el correo ya existe: `registerAction` responde siempre "te enviamos un código" y, con `after()` (para que el tiempo tampoco lo delate), envía el código si la cuenta es nueva o, si ya existía, un aviso a ese correo con enlace de recuperación (`password-reset.ts#notifyExistingAccount`). El código se escribe en el mismo formulario y es el primer inicio de sesión (provider `registration-code` de `auth.ts`), que exige el ticket HMAC que solo recibe quien creó la cuenta (`verification-code.ts#registrationTicket`; con correo existente se entrega uno aleatorio), así nadie entra con un código a una cuenta que ya existía. Luego `/verificar` pide el código del celular. El correo se verifica con código (`identity/email-verification.ts`, SMTP con `lib/email.ts`; las cuentas antiguas sin verificar lo hacen en `/verificar` o el perfil) y el celular por WhatsApp (`identity/phone-verification.ts`, plantilla de autenticación `codigo_verificacion` vía `messaging/auth-code.ts#sendAuthCode`, que es la única excepción al outbox: el usuario lo espera en pantalla). Sin verificar puede navegar y llenar el carrito, pero `createOrderAction` exige `emailVerified` y `phoneVerifiedAt`, y toma `customerPhone` de la BD, nunca del formulario. Los códigos viven en `VerificationCode` (uno por usuario y propósito: `EMAIL`, `PHONE`, `PASSWORD_RESET`), guardados como HMAC con `AUTH_SECRET` ligado al usuario y al destino (`identity/verification-code.ts`, puro); `verification-store.ts#checkCode` cuenta el intento antes de comparar (máx. 5) y borra el código al acertar en la misma transacción que marca la verificación. El celular guardado solo cambia cuando el código del número nuevo es correcto. Envíos limitados por usuario, número e IP (`lib/rate-limit-rules.ts`). Sin SMTP ni WhatsApp, en desarrollo los códigos salen en la consola (`[email:dev]`, `[whatsapp:dev]`).

**Recuperar contraseña**: `/recuperar` (grupo `(recovery)`, que no redirige con sesión iniciada) envía un enlace a `APP_URL/recuperar/nueva?token=…` (nunca se arma con el `Host` de la petición). Responde igual exista o no la cuenta. El token (256 bits) se guarda como HMAC en `VerificationCode` (`PASSWORD_RESET`), vence a los 30 min y se consume una sola vez; al usarlo `identity/password-reset.ts#resetPassword` fija la contraseña, marca el email verificado (solo quien lee el correo pudo abrirlo) y fija `User.sessionsValidFrom`, que anula todas las sesiones abiertas. Si el email no estaba verificado, cualquiera pudo crear la cuenta con él (sin leerlo, el login por contraseña no exige verificarlo) y fijar nombre y celular verificado: `account-rules.ts#passwordResetUpdate` los borra junto con los códigos pendientes, para que los avisos de los pedidos de la dueña no vayan al celular de otro. Las cuentas antiguas creadas con Google no tienen contraseña y entran por aquí.

**Carrito**: estado cliente con Zustand persistido (`ordering/cart-store.ts`), un solo comercio por carrito; en el checkout los precios del cliente se ignoran.

**Catálogo real**: fuente, el catálogo de WhatsApp Business de Dfly (sin promociones temporales ni productos sin precio). `prisma/import-catalog.ts` hace upsert del comercio por `slug` (nombre, descripción, WhatsApp; no toca sector, tiempo de entrega, visibilidad ni imagen, que se ajustan en `/admin`) y del producto por nombre dentro del comercio (precio y descripción); nunca borra.

**Acompañantes y extras**: `ProductOptionGroup` (con `minSelect`/`maxSelect`) y `ProductOption` (`priceDeltaCents` libre). `catalog/options.ts#priceSelection` (puro) valida la selección y calcula el precio; el checkout lo ejecuta con datos de la BD y guarda en `OrderItem` el precio unitario con extras y `optionsSummary` (texto que ve el comercio en WhatsApp). En el carrito, una línea = producto + opciones (`lineKey`). Al editar, `admin/product-options.ts#syncOptionGroups` conserva los ids existentes para no invalidar carritos abiertos.

**Fotos**: `lib/storage.ts` sube a Supabase Storage (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, bucket público `SUPABASE_STORAGE_BUCKET`); sin credenciales, solo en desarrollo, guarda en `public/uploads` (ignorado por git). Valida el tipo por los primeros bytes (`lib/image-type.ts`), máx. 4 MB (`serverActions.bodySizeLimit` = 5 MB en `next.config.ts`, que también autoriza el host de Supabase en `images.remotePatterns`).

**Panel admin** (`src/app/admin`, lógica en `modules/admin`): cada página llama a `identity/session.ts#requireAdmin` y cada acción a `assertAdmin()`; ambos leen el rol de la BD, no del JWT, y a quien no es admin le responden 404. El usuario `ADMIN` lo crea el seed con `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`; si ya existe una cuenta con ese email que no es admin, el seed se detiene (el registro no verifica el email) y solo la asciende, reemplazando su contraseña, con `SEED_ADMIN_PROMOTE_EXISTING="true"`. La cancelación (`ordering/cancel.ts`, compartida por admin y cliente) marca `SKIPPED` el `STORE_REQUEST` aún en cola y avisa al comercio solo si ya recibió el pedido (y no se le avisó antes); si el pedido al comercio sale justo mientras se cancela, el outbox le encola el aviso. Si cancela Dfly se avisa al cliente; si cancela el cliente, al dueño (`ADMIN_CUSTOMER_CANCELLED`).

**Cancelación por el cliente**: al instante solo mientras el comercio no aceptó (`PENDING`, `SENT_TO_STORE`, `EXPIRED`; `ordering/domain.ts#customerCanCancelNow`), desde la página del pedido. Con el pedido `ACCEPTED`, se solicita en `/ayuda` → "Problemas con un pedido" → pedido → motivo (`CancellationRequest`, una por pedido; aviso `ADMIN_CANCEL_REQUEST` al dueño en la misma transacción). El dueño la resuelve en el detalle del pedido del panel: "Aprobar y cancelar" (usa `cancelOrderByAdmin`, que marca la solicitud `APPROVED`) o "Rechazar solicitud" (`CUSTOMER_CANCEL_REJECTED` al cliente). Las solicitudes pendientes salen en "Requieren atención". Si el comercio acepta justo mientras el cliente cancela, gana la primera transición y al cliente se le ofrece solicitarlo.

**Rate limiting**: ventana fija en Postgres (`RateLimitBucket`, upsert atómico en `lib/rate-limit.ts`; límites en `lib/rate-limit-rules.ts`). Login dentro de `authorize()` (cubre también el endpoint de Auth.js) por IP, por email desde esa IP (`login:email-ip`, 8 intentos; así un tercero no deja fuera al dueño desde otra conexión) y por email con un tope alto (`login:email`, 100/h, contra ataques repartidos); al superarlo, el bloqueo dura completo desde ese momento (`blockSec`) y recuperar la contraseña lo quita (`clearRateLimit`), registro por IP y pedidos por usuario. La IP solo sale de la cabecera del proxy de confianza (`TRUSTED_PROXY`, `rate-limit.ts#clientIp`; por defecto `x-vercel-forwarded-for` en Vercel); si no hay una fiable, los límites por IP no se aplican (los de por correo, cuenta y número, sí). El cron `expire-orders` borra las ventanas vencidas.

**Auth**: además de `.claude/rules/auth.md`, las páginas protegidas usan `identity/session.ts#requireUser(returnTo)`; el matcher de `proxy.ts` excluye `/api`, así que cada Route Handler se protege solo. `authorize()` siempre ejecuta un bcrypt (contra un hash ficticio si el email no existe) para no revelar por tiempo qué correos tienen cuenta, y fija `authAt` antes de leer la contraseña. Fuera del proxy, el callback `jwt` de `auth.ts` anula toda sesión cuyo `token.authAt` sea anterior a `sessionsValidFrom` o cuya cuenta ya no exista (`identity/session-validity.ts`); por eso la redirección de `/login` y `/registro` con sesión iniciada la hace `(auth)/layout.tsx` y no el proxy (evita el bucle con una sesión anulada). Un Server Component no puede borrar la cookie de una sesión anulada: si `requireUser` ve la cookie sin sesión válida, pasa por `api/sesion/limpiar` (envuelta en `auth()`, que añade el `Set-Cookie` que la borra; a una sesión válida no la toca) y de ahí a `/login`.
