-- Dispara la Edge Function `agent-process-message` en cada mensaje entrante
-- de un contacto, de forma asíncrona (no bloquea el INSERT). La función
-- resuelve todo lo demás por su cuenta a partir de `message_id` — aquí solo
-- le avisamos que hay algo nuevo que procesar.
--
-- Usa pg_net (HTTP asíncrono desde Postgres) en vez del wrapper
-- `supabase_functions.http_request` que genera el dashboard, porque ese
-- schema solo se provisiona automáticamente al usar la UI de Database
-- Webhooks — con pg_net directo el mismo resultado queda 100% en una
-- migración versionada.
--
-- El Authorization Bearer usa la clave "anon" (pública, sin privilegios:
-- este proyecto tiene RLS deny-by-default) solo para pasar la verificación
-- de JWT de la Edge Function; toda la lectura/escritura real dentro de la
-- función usa su propia service_role key, que Supabase le inyecta
-- automáticamente — no hace falta configurar ningún secreto para esto.
create extension if not exists pg_net with schema extensions;

create or replace function notify_agent_process_message()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://afzbblteskkbmlgrrfkv.supabase.co/functions/v1/agent-process-message',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmemJibHRlc2trYm1sZ3JyZmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyODQzODgsImV4cCI6MjEwMDg2MDM4OH0.iDH0YpSee0N-IZJ8rJhLZU0V8-qUF-K1vJnSVdaLkYM'
    ),
    body := jsonb_build_object('message_id', new.id, 'conversation_id', new.conversation_id)
  );
  return new;
end;
$$;

create trigger trg_agent_process_message
  after insert on messages
  for each row
  when (new.direction = 'inbound' and new.sender_type = 'contact')
  execute function notify_agent_process_message();
