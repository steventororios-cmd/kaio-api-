-- `last_message_at` se actualiza en ambas direcciones (para ordenar el
-- inbox por actividad reciente). La ventana de mensajería de 24h de Meta
-- se cuenta desde el último mensaje ENTRANTE del lead, así que necesita
-- su propia columna para no confundirse cuando el dueño responde.
alter table conversations
  add column last_inbound_at timestamptz;
