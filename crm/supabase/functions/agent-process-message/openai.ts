import { OPENAI_API_KEY } from './config.ts';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: unknown;
};

export async function callOpenAI(
  model: string,
  temperature: number,
  messages: ChatMessage[],
  tools: unknown[]
  // deno-lint-ignore no-explicit-any
): Promise<any> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature, messages, tools, tool_choice: 'auto' }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Voz a texto (Fase 4) — Whisper. `audioBlob` debe traer el content-type real del audio. */
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', audioBlob, 'audio');
  form.append('model', 'whisper-1');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.text as string;
}

export interface ImageAnalysis {
  categoria: 'comprobante_pago' | 'documento_identidad' | 'captura_pantalla' | 'foto_referencia' | 'otro';
  resumen: string;
  detalles?: Record<string, unknown>;
}

/**
 * Visión (Fase 4) — clasifica la imagen y extrae lo relevante (p. ej. monto
 * y fecha de un comprobante de pago), para que el agente sepa cómo
 * responder sin tener que "adivinar" qué le mandaron.
 */
export async function analyzeImage(imageUrl: string): Promise<ImageAnalysis> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Un cliente de una agencia de tours en Medellín envió esta imagen por WhatsApp/Instagram/Messenger. ' +
                'Clasifícala en una de: comprobante_pago, documento_identidad, captura_pantalla, foto_referencia, otro. ' +
                'Si es un comprobante de pago, extrae el monto y la fecha si son visibles, en "detalles". ' +
                'Responde SOLO como JSON con las claves: categoria, resumen (una frase corta en español), detalles (objeto, opcional).',
            },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Vision error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return JSON.parse(json.choices[0].message.content) as ImageAnalysis;
}

/**
 * Generación de imagen de respaldo (Fase 4) — se usa solo cuando un tour
 * todavía no tiene foto real en el catálogo (`tour_media`). El dueño puede
 * reemplazarla después por una foto real subiéndola al catálogo.
 */
export async function generateImage(prompt: string): Promise<Uint8Array> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024' }),
  });
  if (!res.ok) throw new Error(`Image generation error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const b64 = json.data[0].b64_json as string;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
