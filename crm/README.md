# Aventuras CRM

CRM interno de **Aventuras Tour Medellín**: inbox multicanal (WhatsApp, Instagram, Messenger) + pipeline de ventas + agente de IA experto en cierre de ventas de turismo. Ver el plan completo de construcción por fases en la conversación original; este README cubre lo que ya existe y cómo correrlo.

Proyecto nuevo e independiente del resto del repo (el sitio público en `site/` y el backend de Google Ads `index.js.js` no se tocan ni comparten base de datos).

## Estado: Fases 1, 2, 3 y 4 completas

**Fase 1 — CRM base:** esquema completo en Supabase (RLS deny-by-default), catálogo de 16 tours sembrado desde `site/js/data.js`, panel protegido por contraseña con Inbox, Pipeline, Contactos, Tareas, Tours y Configuración del agente.

**Fase 2 — Meta conectado de verdad:** `/api/webhooks/meta` recibe mensajes reales de WhatsApp/Instagram/Messenger (normalizados, firma verificada, deduplicados), y el inbox envía respuestas manuales de verdad por el canal correspondiente.

**Fase 3 — Agente de IA (texto):**
- Edge Function `agent-process-message` (Supabase, Deno) — se dispara automáticamente en cada mensaje entrante de un contacto vía un trigger de base de datos, no desde el webhook de Meta directamente (así el ACK a Meta nunca espera a la IA).
- Arma el contexto con el **catálogo de tours en vivo** desde la tabla `tours` (nunca inventa precios/horarios), el perfil del contacto y los últimos 20 mensajes de la conversación.
- 5 tools que el modelo puede invocar: `update_deal_stage`, `create_deal`, `schedule_followup_task`, `add_tag`, `send_tour_photo`, `handoff_to_human` (pausa la IA y crea una tarea para el dueño).
- Respeta el interruptor de IA por conversación y el interruptor global de Configuración — si cualquiera está apagado, la IA no contesta, punto.

**Fase 4 — Audio, imágenes y generación de fotos:**
- **Audio entrante**: baja la nota de voz de WhatsApp/Instagram/Messenger, la transcribe con Whisper, y la IA responde como si hubiera leído un mensaje de texto normal.
- **Imágenes entrantes**: baja la foto, la clasifica con visión (`comprobante_pago`, `documento_identidad`, `captura_pantalla`, `foto_referencia`, `otro`) y extrae monto/fecha si es un comprobante de pago — si el comprobante no es claro, el agente está instruido a escalar a un humano en vez de asumir que el pago es válido.
- La transcripción/análisis se guarda en el mensaje **aunque la IA esté en pausa** — el dueño se beneficia de igual forma al leer el inbox.
- **`send_tour_photo` ahora genera una imagen de respaldo con `gpt-image-1`** cuando el tour todavía no tiene foto real en el catálogo (queda marcada como `ai_generated` en `tour_media`, para que el dueño la reemplace después por una foto de verdad).

Todavía no incluido (Fase 5, ver el plan): reportes, plantillas de WhatsApp para fuera de la ventana de 24h, debounce de mensajes rápidos, notificaciones de handoff.

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
- Para que el inbox pueda **enviar** mensajes reales: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `MESSENGER_PAGE_ACCESS_TOKEN`, `INSTAGRAM_ACCESS_TOKEN` — de tu Meta App.
- Para que Meta te pueda **enviar** mensajes a este webhook: `META_APP_SECRET` y `META_WEBHOOK_VERIFY_TOKEN`.
- **Para activar el agente de IA (texto, audio, imágenes y generación de fotos): `OPENAI_API_KEY`.** Esta variable va en un lugar distinto a las demás — sigue leyendo.

## Activar el agente de IA — configurar el secreto en Supabase (no en Vercel)

El agente corre en una **Supabase Edge Function**, no en el servidor de Next.js/Vercel, así que su variable de entorno se configura del lado de Supabase:

1. En el dashboard de Supabase de tu proyecto → **Edge Functions** → **Secrets** (o `Project Settings` → `Edge Functions`), agrega:
   - `OPENAI_API_KEY` = tu clave de OpenAI.
   - `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `MESSENGER_PAGE_ACCESS_TOKEN`, `INSTAGRAM_ACCESS_TOKEN` — las mismas que ya pusiste en Vercel, para que la IA también pueda enviar sus respuestas por el canal real.
   - No hace falta configurar `SUPABASE_URL` ni `SUPABASE_SERVICE_ROLE_KEY` — Supabase se los inyecta automáticamente a toda Edge Function.
2. Sin `OPENAI_API_KEY` configurada, el agente simplemente no contesta (lo verifiqué yo mismo — ver más abajo); no rompe nada, el dueño puede seguir contestando a mano.
3. El "cerebro" del agente (personalidad, tono, instrucciones) se edita en `/settings` dentro del panel — no requiere volver a desplegar nada.

## Conectar tus canales reales de Meta

1. Despliega el proyecto (ver sección de abajo) para tener una URL pública — Meta no puede mandarte webhooks a `localhost`.
2. En tu Meta App Dashboard → **Webhooks**: agrega la URL `https://TU-DOMINIO/api/webhooks/meta`, con el mismo `META_WEBHOOK_VERIFY_TOKEN` que pusiste en tus variables de entorno. Suscríbete a los campos `messages` (WhatsApp) y `messages`/`messaging` (Instagram/Messenger).
3. Copia los tokens de tu Meta App a Vercel (para el envío desde el panel) **y** a los Secrets de Supabase Edge Functions (para el envío desde la IA — paso anterior).
4. Escríbele al número de WhatsApp / página / cuenta de Instagram desde tu celular y confirma que el mensaje aparece en `/inbox` — y, con `OPENAI_API_KEY` configurada, que la IA responde sola.

## Sembrar (o re-sembrar) el catálogo de tours

```bash
cd crm
npm run seed:tours
```

Idempotente (upsert por `slug`). También sube las fotos reales de `site/assets/img/gallery/` a Supabase Storage — necesarias para que la tool `send_tour_photo` de la IA pueda mandarlas.

## Probar la ingesta de webhooks sin tráfico real de Meta

```bash
cd crm
npm run dev
npm run simulate:webhook -- whatsapp-text
npm run simulate:webhook -- whatsapp-text --repeat    # prueba idempotencia
```

Con `OPENAI_API_KEY` ya configurada en Supabase, cualquier mensaje simulado que llegue a un contacto nuevo debería generar una respuesta automática visible en `/inbox` unos segundos después.

## Qué verifiqué yo mismo en esta sesión (y qué no pude)

Una nota de transparencia sobre el entorno donde trabajo: no tengo salida de red directa hacia tu proyecto de Supabase desde procesos que yo mismo lanzo (como `npm run dev`) — es una política de la organización, confirmada como un 403 al intentar conectar, no un bug. Por eso no pude probar el panel de Next.js corriendo de verdad contra datos reales (aunque sí compila y typechea limpio). Donde esto **no aplica** es a la Fase 3: el trigger de base de datos y la Edge Function corren dentro de la infraestructura de Supabase, no en mi sandbox — así que ahí sí pude verificar el ciclo completo de verdad:

**Verificado end-to-end, con datos reales, en tu proyecto Supabase:**
- Inserté un mensaje de prueba → el trigger disparó `pg_net` → la Edge Function desplegada lo recibió, se autenticó, y usando su propia `service_role` key (inyectada automáticamente, no configurada por mí) reclamó el mensaje atómicamente (`ai_processed: true`).
- Confirmé en el log de respuestas de `pg_net` (`net._http_response`) el cuerpo exacto de la respuesta: `{"skipped":true,"reason":"OPENAI_API_KEY not configured"}` — el comportamiento correcto sin la clave.
- Apagué `ai_enabled` en una conversación e inserté otro mensaje: la respuesta fue `{"skipped":true,"reason":"AI disabled for this conversation"}` — confirma que el interruptor de control humano funciona.
- Repliqué la lógica SQL de las 5 tools (`create_deal`, `update_deal_stage`, `schedule_followup_task`, `add_tag`, y el toggle de `handoff_to_human`) contra el esquema real — todas ejecutan correctamente.
- Un aviso de seguridad de Supabase (`get_advisors`) señaló que la función del trigger era invocable públicamente vía RPC (`anon`/`authenticated`) — la corregí revocando esos permisos, y confirmé que el trigger sigue funcionando igual después del cambio.
- **Fase 4**: mandé un mensaje de texto (regresión — sigue funcionando igual tras dividir el código en módulos), uno de audio con un `raw_payload` realista de WhatsApp, y uno de tipo `video` (fuera de alcance) — los tres se comportaron exactamente como debían: el de texto y el de audio se reclamaron y respondieron `"OPENAI_API_KEY not configured"`, y el de video se ignoró sin reclamarlo (`ai_processed` se quedó en `false`), como corresponde a un tipo de contenido que no se procesa. También confirmé que los 3 buckets de Storage (`tour-media` público, `generated-media` público, `inbound-media` privado) están configurados exactamente como la tool `send_tour_photo` los espera.
- `npm run build` y `tsc --noEmit` pasan limpio (tuve que excluir `supabase/functions/` del typecheck de Next.js — es código Deno, no Node).

**No pude verificar** (necesita tu `OPENAI_API_KEY`, que no tengo, y las llamadas reales a OpenAI tampoco las puedo hacer yo mismo desde este entorno): una respuesta real generada por el modelo, una transcripción de audio real, un análisis de imagen real, una imagen generada de verdad, ni el envío de cualquiera de esas respuestas por WhatsApp/Instagram/Messenger. Es decir: verifiqué que todo el camino hasta la llamada a OpenAI funciona correctamente (recepción, gatekeeping, descarga de media, manejo de errores), pero no la respuesta de OpenAI en sí. En cuanto pongas la clave en los Secrets de Supabase (sección de arriba), debería funcionar sin más cambios de código.

## Desplegar a producción

Pensado para **Vercel** (recomendado, cero configuración para Next.js) — importa el repo, configura *Root Directory* = `crm`, y agrega las variables de `.env.example` en el panel de Vercel. La Edge Function y su trigger ya están desplegados en Supabase — no requieren ningún paso de deploy adicional de tu parte, solo configurar sus Secrets (sección de arriba).
