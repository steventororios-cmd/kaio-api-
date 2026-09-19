import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

let cached: SupabaseClient<Database> | null = null;

/**
 * Server-only Supabase client using the service_role key.
 * Bypasses RLS — this is safe because every caller is already behind the
 * dashboard's own session gate (see middleware.ts) and this client is never
 * imported from client components.
 */
export function supabaseAdmin(): SupabaseClient<Database> {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Faltan variables de entorno de Supabase: define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (ver crm/.env.example).'
    );
  }

  cached = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
