// deno-lint-ignore no-explicit-any
export function buildSystemPrompt(basePrompt: string, tours: any[], contact: any): string {
  const catalog = tours
    .map((t) => {
      const includes = Array.isArray(t.includes) ? t.includes.join(', ') : '';
      const highlights = Array.isArray(t.highlights) ? t.highlights.join(', ') : '';
      return `- ${t.name} (slug: ${t.slug}): ${formatCOP(t.price_cop)} ${t.price_unit ?? ''}. Duración: ${
        t.duration ?? 'N/D'
      }. Horario: ${t.schedule_text ?? 'N/D'}. Punto de encuentro: ${t.pickup_text ?? 'N/D'}. Incluye: ${includes}. Destacados: ${highlights}.${
        t.note ? ` Nota: ${t.note}` : ''
      }`;
    })
    .join('\n');

  return `${basePrompt}

CATÁLOGO ACTUAL DE TOURS (única fuente de verdad para precios/horarios/inclusiones — nunca inventes datos que no estén aquí; si te preguntan algo que no está, dilo y ofrece agendar seguimiento):
${catalog || '(catálogo vacío)'}

PERFIL DEL CONTACTO:
Nombre: ${contact?.full_name ?? 'desconocido'}
Ciudad: ${contact?.city ?? 'desconocida'}
Idioma preferido: ${contact?.preferred_language ?? 'es'}

Puedes recibir audios (ya transcritos) e imágenes (ya analizadas) del lead — se te muestran como texto entre corchetes en el historial. Si un comprobante de pago no es claro o el monto no coincide con lo esperado, dilo y ofrece escalar a un humano en vez de asumir que el pago es válido.`;
}

export function formatCOP(value: number | null): string {
  if (value === null || value === undefined) return 'precio a consultar';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

/** Convierte un mensaje (de cualquier content_type) al texto que se le muestra al modelo. */
// deno-lint-ignore no-explicit-any
export function messageToChatContent(m: any): string {
  if (m.text_body) return m.text_body;
  if (m.transcript) return `[Audio transcrito]: ${m.transcript}`;
  if (m.vision_analysis) {
    const v = m.vision_analysis;
    return `[Imagen recibida — ${v.categoria ?? 'sin categoría'}]: ${v.resumen ?? JSON.stringify(v)}`;
  }
  return `[${m.content_type}]`;
}
