import type { MetaChannel } from './normalize';

export const GRAPH_API_VERSION = 'v21.0';

export type OutgoingContent =
  | { type: 'text'; text: string }
  | { type: 'image'; imageUrl: string; caption?: string };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} no está configurada. Agrega las credenciales de Meta en las variables de entorno (ver crm/.env.example) para enviar mensajes reales por este canal.`
    );
  }
  return value;
}

async function sendWhatsApp(externalContactId: string, content: OutgoingContent): Promise<string> {
  const accessToken = requireEnv('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = requireEnv('WHATSAPP_PHONE_NUMBER_ID');

  const body =
    content.type === 'text'
      ? { messaging_product: 'whatsapp', to: externalContactId, type: 'text', text: { body: content.text } }
      : {
          messaging_product: 'whatsapp',
          to: externalContactId,
          type: 'image',
          image: { link: content.imageUrl, caption: content.caption },
        };

  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Envío de WhatsApp falló: ${JSON.stringify(json)}`);
  return json.messages?.[0]?.id;
}

async function sendMessenger(externalContactId: string, content: OutgoingContent): Promise<string> {
  const accessToken = requireEnv('MESSENGER_PAGE_ACCESS_TOKEN');

  const message =
    content.type === 'text'
      ? { text: content.text }
      : { attachment: { type: 'image', payload: { url: content.imageUrl, is_reusable: true } } };

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: externalContactId }, message, messaging_type: 'RESPONSE' }),
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`Envío de Messenger falló: ${JSON.stringify(json)}`);
  return json.message_id;
}

async function sendInstagram(externalContactId: string, content: OutgoingContent): Promise<string> {
  const accessToken = requireEnv('INSTAGRAM_ACCESS_TOKEN');

  const message =
    content.type === 'text'
      ? { text: content.text }
      : { attachment: { type: 'image', payload: { url: content.imageUrl } } };

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: externalContactId }, message }),
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`Envío de Instagram falló: ${JSON.stringify(json)}`);
  return json.message_id;
}

/**
 * Plantilla pre-aprobada de WhatsApp — el único mecanismo permitido para
 * escribirle a un lead fuera de la ventana de 24h desde su último mensaje.
 * El nombre y los parámetros deben coincidir con una plantilla ya aprobada
 * por Meta para tu WhatsApp Business Account (Meta Business Manager →
 * WhatsApp Manager → Plantillas de mensajes) — esta función no crea ni
 * aprueba plantillas, solo las envía.
 */
export async function sendTemplateMessage(
  externalContactId: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[]
): Promise<string> {
  const accessToken = requireEnv('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = requireEnv('WHATSAPP_PHONE_NUMBER_ID');

  const body = {
    messaging_product: 'whatsapp',
    to: externalContactId,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(bodyParams.length > 0
        ? { components: [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) }] }
        : {}),
    },
  };

  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Envío de plantilla de WhatsApp falló: ${JSON.stringify(json)}`);
  return json.messages?.[0]?.id;
}

/** Devuelve el id externo del mensaje enviado (para idempotencia/tracking). */
export async function sendMessage(
  channel: MetaChannel,
  externalContactId: string,
  content: OutgoingContent
): Promise<string> {
  switch (channel) {
    case 'whatsapp':
      return sendWhatsApp(externalContactId, content);
    case 'messenger':
      return sendMessenger(externalContactId, content);
    case 'instagram':
      return sendInstagram(externalContactId, content);
  }
}

const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * WhatsApp/Messenger/Instagram solo permiten texto libre dentro de las 24h
 * desde el último mensaje ENTRANTE del lead; fuera de esa ventana hace falta
 * una plantilla pre-aprobada (soporte completo de plantillas: Fase 5).
 */
export function isWithinMessagingWindow(lastInboundAt: string | null): boolean {
  if (!lastInboundAt) return false;
  return Date.now() - new Date(lastInboundAt).getTime() < MESSAGING_WINDOW_MS;
}
