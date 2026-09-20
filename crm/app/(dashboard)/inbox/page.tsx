import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/server';
import { PageHeader, Badge, Card } from '@/components/ui';
import { CHANNEL_LABELS, CHANNEL_COLORS } from '@/lib/types';
import { sendManualMessage, sendTemplateReply, toggleAiEnabled, markConversationRead } from '@/lib/actions/messages';
import { isWithinMessagingWindow } from '@/lib/meta/send';

export const dynamic = 'force-dynamic';

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const params = await searchParams;
  const db = supabaseAdmin();

  const { data: conversations } = await db
    .from('conversations')
    .select('id, channel, status, ai_enabled, unread_count, last_message_at, contact:contacts(id, full_name, phone)')
    .order('last_message_at', { ascending: false, nullsFirst: false });

  const selectedId = params.c ?? conversations?.[0]?.id;
  let messages: any[] = [];
  let selectedConversation: any = null;

  if (selectedId) {
    const { data: conv } = await db
      .from('conversations')
      .select('id, channel, ai_enabled, last_inbound_at, contact:contacts(id, full_name, phone, email)')
      .eq('id', selectedId)
      .maybeSingle();
    selectedConversation = conv;

    const { data: msgs } = await db
      .from('messages')
      .select('*')
      .eq('conversation_id', selectedId)
      .order('created_at', { ascending: true });
    messages = msgs ?? [];

    await markConversationRead(selectedId);
  }

  return (
    <div className="flex h-screen flex-col">
      <PageHeader title="Inbox" description="Conversaciones de todos los canales" />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 shrink-0 overflow-y-auto border-r border-gray-200 bg-white">
          {(conversations ?? []).length === 0 && (
            <p className="p-4 text-sm text-gray-500">
              Aún no hay conversaciones. Se llenará automáticamente cuando conectes WhatsApp/Instagram/Messenger
              (Fase 2), o crea una desde la ficha de un contacto.
            </p>
          )}
          {(conversations ?? []).map((c: any) => (
            <Link
              key={c.id}
              href={`/inbox?c=${c.id}`}
              className={`block border-b border-gray-100 px-4 py-3 hover:bg-gray-50 ${
                c.id === selectedId ? 'bg-brand-50' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="truncate text-sm font-medium text-gray-900">
                  {c.contact?.full_name || c.contact?.phone || 'Sin nombre'}
                </p>
                {c.unread_count > 0 && (
                  <Badge className="bg-brand-600 text-white">{c.unread_count}</Badge>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Badge className={CHANNEL_COLORS[c.channel]}>{CHANNEL_LABELS[c.channel]}</Badge>
                {!c.ai_enabled && <Badge className="bg-amber-100 text-amber-700">IA en pausa</Badge>}
              </div>
            </Link>
          ))}
        </div>

        <div className="flex flex-1 flex-col">
          {!selectedConversation ? (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
              Selecciona una conversación
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedConversation.contact?.full_name || selectedConversation.contact?.phone}
                  </p>
                  <p className="text-xs text-gray-500">{selectedConversation.contact?.phone}</p>
                </div>
                <form
                  action={async () => {
                    'use server';
                    await toggleAiEnabled(selectedConversation.id, !selectedConversation.ai_enabled);
                  }}
                >
                  <button
                    type="submit"
                    className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                      selectedConversation.ai_enabled
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    IA: {selectedConversation.ai_enabled ? 'Activa' : 'En pausa'} · click para cambiar
                  </button>
                </form>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-6">
                {messages.length === 0 && (
                  <p className="text-sm text-gray-400">Sin mensajes todavía.</p>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <Card
                      className={`max-w-md px-3 py-2 ${
                        m.status === 'failed'
                          ? 'border-red-300 bg-red-50'
                          : m.direction === 'outbound'
                            ? 'bg-brand-600 text-white'
                            : 'bg-white'
                      }`}
                    >
                      <p className="text-sm">{m.text_body || `[${m.content_type}]`}</p>
                      {m.transcript && (
                        <p className="mt-1 text-xs italic opacity-80">Transcripción: {m.transcript}</p>
                      )}
                      {m.status === 'failed' && (
                        <p className="mt-1 text-xs font-medium text-red-700">
                          ✕ No se pudo enviar{m.raw_payload?.error ? `: ${m.raw_payload.error}` : ''}
                        </p>
                      )}
                      <p
                        className={`mt-1 text-[10px] ${
                          m.status === 'failed'
                            ? 'text-red-500'
                            : m.direction === 'outbound'
                              ? 'text-brand-100'
                              : 'text-gray-400'
                        }`}
                      >
                        {m.sender_type} · {new Date(m.created_at).toLocaleString('es-CO')}
                      </p>
                    </Card>
                  </div>
                ))}
              </div>

              {selectedConversation.channel === 'internal' ||
              isWithinMessagingWindow(selectedConversation.last_inbound_at) ? (
                <form
                  action={async (formData: FormData) => {
                    'use server';
                    await sendManualMessage(selectedConversation.id, formData);
                  }}
                  className="flex gap-2 border-t border-gray-200 bg-white p-4"
                >
                  <input
                    name="text_body"
                    placeholder="Escribe una respuesta manual…"
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                  >
                    Enviar
                  </button>
                </form>
              ) : selectedConversation.channel === 'whatsapp' ? (
                <form
                  action={async (formData: FormData) => {
                    'use server';
                    await sendTemplateReply(selectedConversation.id, formData);
                  }}
                  className="space-y-2 border-t border-amber-200 bg-amber-50 p-4"
                >
                  <p className="text-xs text-amber-800">
                    Han pasado más de 24h desde el último mensaje del lead — WhatsApp exige una plantilla aprobada
                    para reabrir la conversación.
                  </p>
                  <div className="flex gap-2">
                    <input
                      name="template_name"
                      placeholder="nombre_de_la_plantilla"
                      required
                      className="w-48 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <input
                      name="language_code"
                      placeholder="es"
                      defaultValue="es"
                      className="w-16 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <input
                      name="params"
                      placeholder="parámetros separados por | (opcional)"
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <button
                      type="submit"
                      className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                    >
                      Enviar plantilla
                    </button>
                  </div>
                </form>
              ) : (
                <div className="border-t border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs text-gray-500">
                    Han pasado más de 24h desde el último mensaje del lead. Este canal todavía no soporta plantillas
                    para reabrir la conversación — espera a que el lead vuelva a escribir.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
