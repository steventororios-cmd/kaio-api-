import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { fetchWhatsAppMedia, fetchDirectMediaUrl } from './meta.ts';

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
  return EXT_BY_MIME[mimeType.split(';')[0].trim()] ?? '';
}

/**
 * Baja el audio/imagen entrante (referenciado en `raw_payload`, guardado por
 * el webhook en la Fase 2) y lo sube a Storage. Se llama una sola vez por
 * mensaje — si ya tiene `media_storage_path`, no vuelve a descargar.
 */
export async function ensureMediaDownloaded(
  // deno-lint-ignore no-explicit-any
  db: SupabaseClient,
  // deno-lint-ignore no-explicit-any
  message: any
): Promise<{ storagePath: string; mimeType: string } | null> {
  if (message.media_storage_path) {
    return { storagePath: message.media_storage_path, mimeType: message.media_mime_type ?? 'application/octet-stream' };
  }

  const raw = message.raw_payload;
  let bytes: Uint8Array;
  let mimeType: string;

  if (message.channel === 'whatsapp') {
    const mediaId = raw?.[message.content_type]?.id;
    if (!mediaId) return null;
    const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN no configurado — no se puede descargar el media entrante');
    ({ bytes, mimeType } = await fetchWhatsAppMedia(mediaId, token));
  } else {
    const url = raw?.message?.attachments?.[0]?.payload?.url;
    if (!url) return null;
    ({ bytes, mimeType } = await fetchDirectMediaUrl(url));
  }

  const storagePath = `${message.conversation_id}/${message.id}${extFromMime(mimeType)}`;
  const { error } = await db.storage.from('inbound-media').upload(storagePath, bytes, { contentType: mimeType, upsert: true });
  if (error) throw new Error(`No se pudo subir el media entrante a Storage: ${error.message}`);

  await db.from('messages').update({ media_storage_path: storagePath, media_mime_type: mimeType }).eq('id', message.id);

  return { storagePath, mimeType };
}
