-- Para el reporte de tiempo de respuesta: por cada mensaje ENTRANTE, busca
-- el siguiente mensaje SALIENTE en la misma conversación (sin importar si
-- hay otros entrantes en el medio — mide "cuánto tardó en atenderse", no
-- estrictamente "respuesta directa a este mensaje").
create view response_time_seconds as
select
  m.id as message_id,
  m.conversation_id,
  c.channel,
  extract(epoch from (nxt.created_at - m.created_at)) as response_seconds
from messages m
join conversations c on c.id = m.conversation_id
join lateral (
  select m2.created_at
  from messages m2
  where m2.conversation_id = m.conversation_id
    and m2.direction = 'outbound'
    and m2.created_at > m.created_at
  order by m2.created_at
  limit 1
) nxt on true
where m.direction = 'inbound';

-- Sin esto, la vista corre con los permisos de quien la creó (bypassea RLS
-- para cualquiera que la consulte) en vez de con los del rol que hace la
-- consulta — señalado como ERROR por el linter de seguridad de Supabase.
alter view response_time_seconds set (security_invoker = true);
