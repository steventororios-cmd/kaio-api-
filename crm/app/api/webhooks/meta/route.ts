import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyMetaSignature } from '@/lib/meta/verifySignature';
import { normalizeMetaWebhook, type InternalMessage } from '@/lib/meta/normalize';
import { logEvent } from '@/lib/actions/events';
import type { Json } from '@/lib/database.types';

// Necesita el runtime Node.js (no Edge) por `node:crypto` en verifySignature.
export const runtime = 'nodejs';

type Db = ReturnType<typeof supabaseAdmin>;

/**
 * GET — challenge de verificación de suscripción del webhook de Meta.
 * Configúralo en Meta App Dashboard → Webhooks, con esta URL y el mismo
 * META_WEBHOOK_VERIFY_TOKEN que pongas en tus variables de entorno.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

/**
 * POST — ingesta de eventos de mensajería de WhatsApp/Instagram/Messenger.
 * Responde 200 lo más rápido posible (Meta reintenta si no lo hace);
 * el procesamiento con IA (Fases 3-4) ocurre después, disparado por un
 * Database Webhook sobre la tabla `messages`, no aquí.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256');
  const appSecret = process.env.META_APP_SECRET;

  if (appSecret) {
    if (!verifyMetaSignature(rawBody, signature, appSecret)) {
      return new NextResponse('Invalid signature', { status: 401 });
    }
  } else {
    console.warn(
      'META_APP_SECRET no configurado: se omite la verificación de firma. Configúralo antes de exponer este endpoint en producción.'
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 });
  }

  const messages = normalizeMetaWebhook(body);
  const db = supabaseAdmin();

  for (const msg of messages) {
    try {
      await ingestMessage(db, msg);
    } catch (err) {
      // No abortamos el resto del batch por un mensaje problemático, pero sí
      // lo dejamos en el log de eventos para poder investigarlo.
      console.error('Error ingiriendo mensaje de Meta:', err);
      await logEvent({
        event_type: 'webhook_ingest_error',
        actor: 'system',
        payload: { error: err instanceof Error ? err.message : String(err), channel: msg.channel },
      });
    }
  }

  return NextResponse.json({ status: 'ok', processed: messages.length });
}

async function findOrCreateContact(db: Db, msg: InternalMessage): Promise<string> {
  const { data: existing } = await db
    .from('contact_channels')
    .select('contact_id')
    .eq('channel', msg.channel)
    .eq('external_id', msg.externalContactId)
    .maybeSingle();
  if (existing) return existing.contact_id;

  const { data: newContact, error: contactError } = await db
    .from('contacts')
    .insert({
      full_name: msg.displayName ?? null,
      phone: msg.channel === 'whatsapp' ? msg.externalContactId : null,
    })
    .select('id')
    .single();
  if (contactError) throw new Error(contactError.message);

  const { error: channelError } = await db.from('contact_channels').insert({
    contact_id: newContact.id,
    channel: msg.channel,
    external_id: msg.externalContactId,
    display_name: msg.displayName ?? null,
  });
  if (channelError) throw new Error(channelError.message);

  return newContact.id;
}

async function findOrCreateConversation(
  db: Db,
  contactId: string,
  channel: InternalMessage['channel']
): Promise<{ id: string; unread_count: number }> {
  const { data: existing } = await db
    .from('conversations')
    .select('id, unread_count')
    .eq('contact_id', contactId)
    .eq('channel', channel)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await db
    .from('conversations')
    .insert({ contact_id: contactId, channel })
    .select('id, unread_count')
    .single();
  if (error) throw new Error(error.message);
  return created;
}

async function ingestMessage(db: Db, msg: InternalMessage): Promise<void> {
  // Idempotencia: Meta reintenta la entrega de webhooks, así que un mismo
  // mensaje puede llegar más de una vez.
  const { data: duplicate } = await db
    .from('messages')
    .select('id')
    .eq('channel', msg.channel)
    .eq('external_message_id', msg.externalMessageId)
    .maybeSingle();
  if (duplicate) return;

  const contactId = await findOrCreateContact(db, msg);
  const conversation = await findOrCreateConversation(db, contactId, msg.channel);

  const { error: msgError } = await db.from('messages').insert({
    conversation_id: conversation.id,
    direction: 'inbound',
    channel: msg.channel,
    external_message_id: msg.externalMessageId,
    sender_type: 'contact',
    content_type: msg.contentType,
    text_body: msg.text ?? null,
    media_mime_type: msg.mediaMimeType ?? null,
    raw_payload: msg.raw as Json,
    status: 'received',
  });
  if (msgError) throw new Error(msgError.message);

  const now = new Date().toISOString();
  await db
    .from('conversations')
    .update({
      last_message_at: now,
      last_inbound_at: now,
      unread_count: conversation.unread_count + 1,
    })
    .eq('id', conversation.id);

  await logEvent({
    event_type: 'message_received',
    actor: 'system',
    contact_id: contactId,
    conversation_id: conversation.id,
    payload: { channel: msg.channel, content_type: msg.contentType },
  });
}
