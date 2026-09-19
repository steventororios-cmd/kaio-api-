# Aventuras CRM

CRM interno de **Aventuras Tour Medellín**: inbox multicanal (WhatsApp, Instagram, Messenger) + pipeline de ventas + agente de IA experto en cierre de ventas de turismo. Ver el plan completo de construcción por fases en la conversación original; este README cubre lo que ya existe y cómo correrlo.

Proyecto nuevo e independiente del resto del repo (el sitio público en `site/` y el backend de Google Ads `index.js.js` no se tocan ni comparten base de datos).

## Estado: Fase 1 completa

Lo que ya funciona:
- Esquema completo de base de datos en Supabase (proyecto `afzbblteskkbmlgrrfkv`), con RLS habilitado en modo deny-by-default — toda la app lee/escribe con la `service_role` key en el servidor, nunca desde el navegador.
- Catálogo de 16 tours sembrado desde `site/js/data.js` (precios, horarios, incluye, highlights reales).
- Panel protegido por contraseña (`/login`), con Inbox, Pipeline (kanban), Contactos, Tareas, Catálogo de tours y Configuración del agente de IA.
- El inbox funciona en modo manual/interno: se pueden crear conversaciones y responder a mano; todavía no hay canales reales conectados (eso es la Fase 2) ni respuestas automáticas de IA (Fase 3).

Todavía no incluido (fases siguientes, ver el plan): webhooks reales de Meta (WhatsApp/Instagram/Messenger), el agente de IA (texto, luego audio/imagen), envío de fotos de tours, reportes y plantillas de WhatsApp.

## Cómo correrlo localmente

```bash
cd crm
npm install
cp .env.example .env.local
# completa .env.local (ver siguiente sección)
npm run dev
```

Abre `http://localhost:3000` — te pedirá la contraseña definida en `CRM_OWNER_PASSWORD`.

## Variables de entorno que necesitas completar

Copia `crm/.env.example` a `crm/.env.local` y completa, como mínimo, para que el panel muestre datos reales:

- `NEXT_PUBLIC_SUPABASE_URL=https://afzbblteskkbmlgrrfkv.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` — **esta es la única que yo no puedo obtener por ti** (no se expone por API, es intencional por seguridad). La encuentras en el dashboard de Supabase de ese proyecto → *Project Settings* → *API* → *service_role key* (sección "secret keys"). Sin ella, el panel carga pero no puede leer ni escribir nada (RLS bloquea todo lo que no sea `service_role`) — así lo verifiqué yo mismo en esta sesión, con la clave `anon` de prueba: todo renderiza pero "no hay datos", que es el comportamiento correcto y esperado.
- `CRM_OWNER_PASSWORD` y `SESSION_SECRET` — inventa los tuyos (ver instrucciones dentro del `.env.example` para generar `SESSION_SECRET`).

Las variables de Meta/OpenAI (`WHATSAPP_*`, `MESSENGER_*`, `INSTAGRAM_*`, `META_*`, `OPENAI_API_KEY`) todavía no se usan — son para las Fases 2-4.

## Sembrar (o re-sembrar) el catálogo de tours

Ya está sembrado en la base de datos de Supabase, pero si el catálogo del sitio web (`site/js/data.js`) cambia, puedes re-sincronizarlo (incluyendo subir las fotos reales de `site/assets/img/gallery/` a Supabase Storage, algo que yo no pude hacer desde esta sesión sin la `service_role key`):

```bash
cd crm
npm run seed:tours
```

Es idempotente (usa upsert por `slug`), así que puedes correrlo las veces que quieras.

## Qué verifiqué yo mismo en esta sesión (sin tus credenciales)

- Apliqué el esquema completo (`supabase/migrations/`) directamente contra tu proyecto Supabase vía la integración MCP.
- Sembré los 16 tours reales (extraídos programáticamente de `site/js/data.js`, sin transcripción manual) y confirmé en la base de datos que precios, horarios e inclusiones quedaron exactos.
- Creé los 3 buckets de Storage (`tour-media` público, `generated-media` público, `inbound-media` privado).
- `npm run build` y `tsc --noEmit` pasan limpio, 0 vulnerabilidades de `npm audit` (actualicé Next.js a la versión parcheada más reciente).
- Corrí el servidor localmente contra tu proyecto Supabase real (con la clave `anon`, ya que no tengo la `service_role`) y confirmé de punta a punta: login con contraseña incorrecta rechaza sin cookie, login correcto genera la cookie de sesión firmada y redirige, todas las páginas del panel cargan (200) estando autenticado, y las páginas protegidas redirigen a `/login` sin sesión. También confirmé que RLS bloquea correctamente la clave `anon` (comportamiento de seguridad esperado).

Lo único que **no pude** verificar end-to-end por falta de esa clave secreta: ver los datos reales (los 16 tours, contactos, etc.) renderizados en el panel. Una vez pongas `SUPABASE_SERVICE_ROLE_KEY` en tu `.env.local` (o en las variables de entorno de Vercel al desplegar), todo debería mostrarse de inmediato — no debería hacer falta ningún otro cambio de código para eso.

## Desplegar a producción

Pensado para **Vercel** (recomendado, cero configuración para Next.js) — importa el repo, configura *Root Directory* = `crm`, y agrega las mismas variables de `.env.example` en el panel de Vercel. Ver el plan original para el resto de fases (webhooks de Meta necesitan una URL pública, que Vercel te da automáticamente).
