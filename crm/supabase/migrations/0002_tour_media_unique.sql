-- Permite que el seed de tours (supabase/seed/import-tours-from-site.ts) sea
-- idempotente vía upsert onConflict('tour_id,storage_path').
alter table tour_media
  add constraint tour_media_tour_storage_unique unique (tour_id, storage_path);
