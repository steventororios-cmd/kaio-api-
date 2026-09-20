import { GRAPH_API_VERSION } from './config.ts';

const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isWithinMessagingWindow(lastInboundAt: string | null): boolean {
  if (!lastInboundAt) return false;
  return Date.now() - new Date(lastInboundAt).getTime() < MESSAGING_WINDOW_MS;
}

/** WhatsApp solo manda un media_id — hay que resolverlo a una URL temporal y descargarla. */
export async function fetchWhatsAppMedia(
  mediaId: string,
  accessToken: string
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaRes.ok) throw new Error(`No se pudo resolver el media_id ${mediaId}: HTTP ${metaRes.status}`);
  const meta = (await metaRes.json()) as { url: string; mime_type?: string };

  const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!fileRes.ok) throw new Error(`No se pudo descargar el media ${mediaId}: HTTP ${fileRes.status}`);

  const bytes = new Uint8Array(await fileRes.arrayBuffer());
  const mimeType = meta.mime_type ?? fileRes.headers.get('content-type') ?? 'application/octet-stream';
  return { bytes, mimeType };
}

/** Messenger/Instagram incluyen una URL de adjunto directamente descargable. */
export async function fetchDirectMediaUrl(url: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar el adjunto: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const mimeType = res.headers.get('content-type') ?? 'application/octet-stream';
  return { bytes, mimeType };
}

export async function sendTextViaMeta(channel: string, externalId: string, text: string): Promise<string | undefined> {
  if (channel === 'whatsapp') {
    const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    if (!token || !phoneId) throw new Error('WhatsApp no está configurado (faltan credenciales)');
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: externalId, type: 'text', text: { body: text } }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`WhatsApp send failed: ${JSON.stringify(data)}`);
    return data.messages?.[0]?.id;
  }
  return sendViaGraphMessages(channel, externalId, { text });
}

export async function sendImageViaMeta(channel: string, externalId: string, imageUrl: string): Promise<string | undefined> {
  if (channel === 'whatsapp') {
    const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    if (!token || !phoneId) throw new Error('WhatsApp no está configurado (faltan credenciales)');
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: externalId, type: 'image', image: { link: imageUrl } }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`WhatsApp send failed: ${JSON.stringify(data)}`);
    return data.messages?.[0]?.id;
  }
  return sendViaGraphMessages(channel, externalId, { attachment: { type: 'image', payload: { url: imageUrl } } });
}

async function sendViaGraphMessages(channel: string, externalId: string, message: unknown): Promise<string | undefined> {
  const tokenEnvVar = channel === 'messenger' ? 'MESSENGER_PAGE_ACCESS_TOKEN' : 'INSTAGRAM_ACCESS_TOKEN';
  const token = Deno.env.get(tokenEnvVar);
  if (!token) throw new Error(`${channel} no está configurado (falta ${tokenEnvVar})`);
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: externalId }, message }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`${channel} send failed: ${JSON.stringify(data)}`);
  return data.message_id;
}
