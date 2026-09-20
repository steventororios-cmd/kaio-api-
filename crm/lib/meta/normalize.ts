/**
 * Normaliza los tres formatos de webhook de Meta (WhatsApp Cloud API,
 * Messenger Platform, Instagram Messaging) a un mismo formato interno.
 * Los tres comparten en gran parte la forma del webhook de Graph API; se
 * distinguen por el campo `object` del body.
 */

export type MetaChannel = 'whatsapp' | 'instagram' | 'messenger';

export type InternalContentType =
  | 'text'
  | 'audio'
  | 'image'
  | 'video'
  | 'document'
  | 'sticker'
  | 'location';

export interface InternalMessage {
  channel: MetaChannel;
  /** wa_id (WhatsApp) / IGSID (Instagram) / PSID (Messenger) */
  externalContactId: string;
  externalMessageId: string;
  contentType: InternalContentType;
  text?: string;
  /** Solo WhatsApp: requiere resolverse vía Graph API + token (ver lib/meta/media.ts) */
  mediaId?: string;
  /** Messenger/Instagram: URL de adjunto directamente descargable */
  mediaUrl?: string;
  mediaMimeType?: string;
  timestampMs: number;
  /** Nombre de perfil, cuando Meta lo incluye (típicamente WhatsApp) */
  displayName?: string;
  /** El objeto original de este mensaje puntual, para depuración y para las Fases 3-4 */
  raw: unknown;
}

export function normalizeMetaWebhook(body: any): InternalMessage[] {
  if (!body || typeof body !== 'object') return [];

  switch (body.object) {
    case 'whatsapp_business_account':
      return normalizeWhatsApp(body);
    case 'page':
      return normalizeMessagingEntries(body, 'messenger');
    case 'instagram':
      return normalizeMessagingEntries(body, 'instagram');
    default:
      return [];
  }
}

function normalizeWhatsApp(body: any): InternalMessage[] {
  const out: InternalMessage[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue;
      const value = change.value ?? {};
      const messages = value.messages ?? [];
      if (messages.length === 0) continue; // p. ej. eventos de estado (delivered/read), no mensajes

      const profileByWaId = new Map<string, string>();
      for (const c of value.contacts ?? []) {
        if (c.wa_id && c.profile?.name) profileByWaId.set(c.wa_id, c.profile.name);
      }

      for (const msg of messages) {
        const contentType = mapWhatsAppType(msg.type);
        if (!contentType) continue; // tipo no soportado (p. ej. botones interactivos), se ignora por ahora

        const mediaField = msg[msg.type];
        out.push({
          channel: 'whatsapp',
          externalContactId: msg.from,
          externalMessageId: msg.id,
          contentType,
          text: msg.type === 'text' ? msg.text?.body : mediaField?.caption,
          mediaId: mediaField?.id,
          mediaMimeType: mediaField?.mime_type,
          timestampMs: Number(msg.timestamp) * 1000,
          displayName: profileByWaId.get(msg.from),
          raw: msg,
        });
      }
    }
  }

  return out;
}

function mapWhatsAppType(type: string): InternalContentType | null {
  switch (type) {
    case 'text':
    case 'audio':
    case 'image':
    case 'video':
    case 'document':
    case 'sticker':
    case 'location':
      return type;
    default:
      return null; // button, interactive, reaction, unsupported, etc.
  }
}

/** Messenger e Instagram comparten la misma forma entry[].messaging[]. */
function normalizeMessagingEntries(body: any, channel: 'messenger' | 'instagram'): InternalMessage[] {
  const out: InternalMessage[] = [];

  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      // Eventos sin `message` (deliveries, reads, postbacks de botones) se ignoran por ahora.
      if (!event.message || event.message.is_echo) continue;

      const message = event.message;
      const attachment = message.attachments?.[0];

      let contentType: InternalContentType = 'text';
      let mediaUrl: string | undefined;
      let mediaMimeType: string | undefined;

      if (attachment) {
        contentType = mapAttachmentType(attachment.type);
        mediaUrl = attachment.payload?.url;
      }

      out.push({
        channel,
        externalContactId: event.sender.id,
        externalMessageId: message.mid,
        contentType,
        text: message.text,
        mediaUrl,
        mediaMimeType,
        timestampMs: Number(event.timestamp) || Date.now(),
        raw: event,
      });
    }
  }

  return out;
}

function mapAttachmentType(type: string): InternalContentType {
  switch (type) {
    case 'image':
      return 'image';
    case 'audio':
      return 'audio';
    case 'video':
      return 'video';
    case 'file':
      return 'document';
    default:
      return 'document';
  }
}
