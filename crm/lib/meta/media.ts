/**
 * Helpers para bajar medios entrantes (audio/imagen) de Meta y subirlos a
 * Supabase Storage. Estos NO se llaman todavía desde la ruta de ingesta del
 * webhook (Fase 2) — se conectan en la Edge Function `agent-process-message`
 * de las Fases 3-4, para no bloquear el ACK rápido que Meta espera del
 * webhook. Se dejan listos aquí porque son parte natural de la capa de
 * integración con Meta.
 */
import { GRAPH_API_VERSION } from './send';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

/**
 * WhatsApp solo manda un `media_id` en el webhook — hay que resolverlo a una
 * URL temporal (vía Graph API) y descargarla, ambos pasos con el access
 * token de WhatsApp.
 */
export async function fetchWhatsAppMedia(
  mediaId: string,
  accessToken: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaRes.ok) {
    throw new Error(`No se pudo resolver el media_id ${mediaId}: HTTP ${metaRes.status}`);
  }
  const meta = (await metaRes.json()) as { url: string; mime_type?: string };

  const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!fileRes.ok) {
    throw new Error(`No se pudo descargar el media ${mediaId}: HTTP ${fileRes.status}`);
  }

  const buffer = Buffer.from(await fileRes.arrayBuffer());
  const mimeType = meta.mime_type ?? fileRes.headers.get('content-type') ?? 'application/octet-stream';
  return { buffer, mimeType };
}

/**
 * Messenger e Instagram incluyen una URL de adjunto directamente
 * descargable en el propio payload del webhook (sin token adicional).
 */
export async function fetchDirectMediaUrl(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar el adjunto: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get('content-type') ?? 'application/octet-stream';
  return { buffer, mimeType };
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'video/mp4': '.mp4',
};

function extFromMime(mimeType: string): string {
  const base = mimeType.split(';')[0].trim();
  return EXT_BY_MIME[base] ?? '';
}

export async function uploadInboundMedia(
  db: SupabaseClient<Database>,
  conversationId: string,
  messageId: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const storagePath = `${conversationId}/${messageId}${extFromMime(mimeType)}`;
  const { error } = await db.storage.from('inbound-media').upload(storagePath, buffer, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) throw new Error(`No se pudo subir el media a Storage: ${error.message}`);
  return storagePath;
}
