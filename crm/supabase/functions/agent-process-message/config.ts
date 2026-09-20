// Supabase inyecta SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY automáticamente
// en toda Edge Function — no hace falta configurarlos a mano. OPENAI_API_KEY
// y las credenciales de Meta sí hay que agregarlas como Secrets del proyecto
// (ver crm/README.md).
export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
export const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
export const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
export const GRAPH_API_VERSION = 'v21.0';
