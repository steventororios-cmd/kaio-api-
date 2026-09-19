import type { Database } from './database.types';

export type Contact = Database['public']['Tables']['contacts']['Row'];
export type ContactChannel = Database['public']['Tables']['contact_channels']['Row'];
export type Conversation = Database['public']['Tables']['conversations']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type PipelineStage = Database['public']['Tables']['pipeline_stages']['Row'];
export type Tour = Database['public']['Tables']['tours']['Row'];
export type TourMedia = Database['public']['Tables']['tour_media']['Row'];
export type Deal = Database['public']['Tables']['deals']['Row'];
export type Task = Database['public']['Tables']['tasks']['Row'];
export type Note = Database['public']['Tables']['notes']['Row'];
export type Tag = Database['public']['Tables']['tags']['Row'];
export type AgentSettings = Database['public']['Tables']['agent_settings']['Row'];
export type EventRow = Database['public']['Tables']['events']['Row'];

export const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
  internal: 'Interno',
};

export const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: 'bg-green-100 text-green-700',
  instagram: 'bg-pink-100 text-pink-700',
  messenger: 'bg-blue-100 text-blue-700',
  internal: 'bg-gray-100 text-gray-700',
};

export function formatCOP(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}
