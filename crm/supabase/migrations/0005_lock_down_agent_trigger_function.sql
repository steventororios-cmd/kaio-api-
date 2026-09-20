-- notify_agent_process_message() solo debe dispararse como trigger, nunca
-- ser invocable directamente vía RPC pública (PostgREST expone por defecto
-- toda función en el schema public). Encontrado por el linter de seguridad
-- de Supabase (get_advisors) justo después de crear el trigger; el trigger
-- sigue funcionando igual tras revocar estos permisos.
revoke execute on function notify_agent_process_message() from public, anon, authenticated;
