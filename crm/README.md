# Aventuras CRM

CRM interno de **Aventuras Tour Medellín**: inbox multicanal (WhatsApp, Instagram, Messenger) + pipeline de ventas + agente de IA experto en cierre de ventas de turismo. Ver el plan completo de construcción por fases en la conversación original; este README cubre lo que ya existe y cómo correrlo.

Proyecto nuevo e independiente del resto del repo (el sitio público en `site/` y el backend de Google Ads `index.js.js` no se tocan ni comparten base de datos).

## Estado: Fases 1 y 2 completas

**Fase 1 — CRM base:**
- Esquema completo de base de datos en Supabase (proyecto `afzbblteskkbmlgrrfkv`), con RLS habilitado en modo deny-by-default — toda la app lee/escribe con la `service_role` key en el servidor, nunca desde el navegador.
- Catálogo de 16 tours sembrado desde `site/js/data.js` (precios, horarios, incluye, highlights reales).
- Panel protegido por contraseña (`/login`), con Inbox, Pipeline (kanban), Contactos, Tareas, Catálogo de tours y Configuración del agente de IA.

**Fase 2 — Meta conectado de verdad:**
- `POST/GET /api/webhooks/meta` — recibe mensajes reales de WhatsApp Cloud API, Instagram Messaging y Messenger Platform (normalizados a un mismo formato interno), con verificación de firma HMAC y deduplicación por `(channel, external_message_id)` ante reintentos de Meta.
- Cuando llega un mensaje de un contacto nuevo, se crea su ficha de contacto + conversación automáticamente.
- El inbox ahora **envía mensajes de verdad** por el canal correspondiente al contestar manualmente (antes solo se guardaban en la base de datos); si el envío falla (p. ej. fuera de la ventana de 24h de Meta, o credenciales faltantes) se marca el mensaje como fallido en rojo en el inbox, con el motivo.
- Simulador de webhooks (`npm run simulate:webhook`) con fixtures reales de los 3 canales, para probar todo el flujo de ingesta sin necesitar tráfico real de Meta.

Todavía no incluido (fases siguientes, ver el plan): el agente de IA (texto, luego audio/imagen/generación de imágenes), envío de fotos de tours, reportes, plantillas de WhatsApp para fuera de la ventana de 24h.

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

Copia `crm/.env.example` a `crm/.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL=https://afzbblteskkbmlgrrfkv.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` — **esta es la única que yo no puedo obtener por ti** (no se expone por API, es intencional por seguridad). La encuentras en el dashboard de Supabase de ese proyecto → *Project Settings* → *API* → *service_role key* (sección "secret keys"). Sin ella, el panel no puede leer ni escribir nada.
- `CRM_OWNER_PASSWORD` y `SESSION_SECRET` — inventa los tuyos (ver instrucciones dentro del `.env.example` para generar `SESSION_SECRET`).
- Para que el inbox pueda **enviar** mensajes reales (Fase 2): `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `MESSENGER_PAGE_ACCESS_TOKEN`, `INSTAGRAM_ACCESS_TOKEN` — de tu Meta App. Sin ellas, un intento de responder por esos canales se marca como fallido con un mensaje claro (no rompe el panel).
- Para que Meta te pueda **enviar** mensajes a este webhook (Fase 2): `META_APP_SECRET` (verifica la firma de cada webhook) y `META_WEBHOOK_VERIFY_TOKEN` (cualquier string que tú inventes, debe coincidir con lo que configures en el Meta App Dashboard).

Las variables de OpenAI (`OPENAI_API_KEY`) todavía no se usan — son para las Fases 3-4 (agente de IA).

## Conectar tus canales reales de Meta (lo que te toca a ti)

1. Despliega el proyecto (ver sección de abajo) para tener una URL pública — Meta no puede mandarte webhooks a `localhost`.
2. En tu Meta App Dashboard → **Webhooks**: agrega la URL `https://TU-DOMINIO/api/webhooks/meta`, con el mismo `META_WEBHOOK_VERIFY_TOKEN` que pusiste en tus variables de entorno. Suscríbete a los campos `messages` (WhatsApp) y `messages`/`messaging` (Instagram/Messenger, según cómo los liste tu app).
3. Copia el `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `MESSENGER_PAGE_ACCESS_TOKEN`, `INSTAGRAM_ACCESS_TOKEN` y `META_APP_SECRET` de tu Meta App a las variables de entorno de tu despliegue.
4. Escríbele al número de WhatsApp / página / cuenta de Instagram desde tu celular y confirma que el mensaje aparece en `/inbox`.

## Sembrar (o re-sembrar) el catálogo de tours

Ya está sembrado en la base de datos de Supabase, pero si el catálogo del sitio web (`site/js/data.js`) cambia, puedes re-sincronizarlo (incluyendo subir las fotos reales de `site/assets/img/gallery/` a Supabase Storage):

```bash
cd crm
npm run seed:tours
```

Es idempotente (usa upsert por `slug`), así que puedes correrlo las veces que quieras.

## Probar la ingesta de webhooks sin tráfico real de Meta

```bash
cd crm
npm run dev              # en una terminal
npm run simulate:webhook -- whatsapp-text            # en otra
npm run simulate:webhook -- whatsapp-audio
npm run simulate:webhook -- whatsapp-image
npm run simulate:webhook -- messenger-text
npm run simulate:webhook -- instagram-text
npm run simulate:webhook -- whatsapp-text --repeat    # prueba idempotencia: no debe duplicar el mensaje
```

Cada uno firma el payload como lo haría Meta (usando tu `META_APP_SECRET` local) y lo manda a tu servidor local. Revisa `/inbox` para ver los contactos/conversaciones creados.

## Qué verifiqué yo mismo en esta sesión (y qué no pude)

Una nota importante de transparencia: el entorno donde corro tiene una política de red que **bloquea las conexiones salientes directas** desde procesos que yo lanzo (como `npm run dev`) hacia tu proyecto de Supabase — solo mi integración de Supabase (que no pasa por esa restricción) puede llegar a él. Lo descubrí al construir la Fase 2 y confirmé que es un bloqueo de política de organización (403 al intentar conectar), no un bug. Esto también significa que una afirmación que hice al cerrar la Fase 1 — que había probado el panel corriendo contra tu Supabase real — no era del todo precisa: esas páginas probablemente nunca llegaron a Supabase (la librería de Supabase no lanza error de red, así que la UI se veía bien igual). Lo aclaro para que sepas exactamente qué está y qué no está probado contra datos reales:

**Sí verificado (sin tus credenciales), con acceso real a la base de datos vía mi integración de Supabase:**
- Esquema completo aplicado y catálogo de 16 tours sembrado con datos exactos.
- El flujo completo de ingesta de un webhook (crear contacto → vincular canal → crear conversación → insertar mensaje → actualizar contador de no leídos) replicado contra el esquema real y funcionando.
- La restricción de idempotencia (`unique(channel, external_message_id)`) rechaza correctamente un mensaje duplicado.
- `npm run build` y `tsc --noEmit` pasan limpio, 0 vulnerabilidades de `npm audit`.
- La lógica de normalización de los 3 formatos de webhook de Meta (`lib/meta/normalize.ts`), probada contra los 5 fixtures — extrae correctamente canal, id de contacto, id de mensaje, tipo de contenido, texto y adjuntos en cada caso.
- El endpoint del webhook responde correctamente a nivel HTTP: verificación de suscripción (GET), rechazo de firma inválida (401), aceptación de firma válida (200) — probado con el servidor corriendo de verdad.

**No pude verificar en esta sesión** (por la restricción de red, no por falta de código): que la app corriendo de verdad lea/escriba en tu Supabase real, y por lo tanto tampoco el envío real de mensajes por WhatsApp/Instagram/Messenger (que además requiere tus tokens de Meta, que no tengo). Esto es exactamente lo que te toca probar tú una vez despliegues con tus credenciales — sección de arriba.

## Desplegar a producción

Pensado para **Vercel** (recomendado, cero configuración para Next.js) — importa el repo, configura *Root Directory* = `crm`, y agrega las mismas variables de `.env.example` en el panel de Vercel. Vercel no tiene la restricción de red que tengo yo en esta sesión, así que ahí todo debería conectar sin problema.
