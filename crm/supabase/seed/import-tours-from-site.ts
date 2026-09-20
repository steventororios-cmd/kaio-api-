/**
 * Siembra el catálogo de tours del CRM desde site/js/data.js — el catálogo
 * real que ya usa el sitio público de Aventuras Tour Medellín. Así el
 * dueño no tiene que volver a digitar nada, y el agente de IA (Fase 3)
 * arranca con precios y disponibilidad reales.
 *
 * Uso: dentro de crm/, con las variables de entorno configuradas
 * (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY):
 *   npm run seed:tours
 *
 * Es idempotente: se puede correr varias veces (upsert por slug).
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Next.js usa .env.local para desarrollo; este script standalone no pasa
// por Next, así que cargamos el mismo archivo explícitamente.
dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config(); // .env como respaldo

interface SiteTour {
  id: string;
  photo: string | null;
  name: string;
  tag?: string;
  category?: string;
  price: number;
  priceUnit?: string;
  schedule?: string;
  pickup?: string;
  duration?: string;
  includes?: string[];
  highlights?: string[];
  note?: string;
}

const repoRoot = path.resolve(__dirname, '../../../');
const dataJsPath = path.join(repoRoot, 'site/js/data.js');

function loadToursFromSiteData(): SiteTour[] {
  const source = fs.readFileSync(dataJsPath, 'utf8');
  const sandbox: Record<string, unknown> = {};
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: dataJsPath });
  const tours = sandbox.TOURS as SiteTour[] | undefined;
  if (!tours || !Array.isArray(tours)) {
    throw new Error(`No se pudo extraer TOURS de ${dataJsPath}`);
  }
  return tours;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Copia crm/.env.example a crm/.env.local y complétalo.'
    );
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const tours = loadToursFromSiteData();
  console.log(`Encontrados ${tours.length} tours en site/js/data.js`);

  for (const t of tours) {
    const { data: tourRow, error } = await db
      .from('tours')
      .upsert(
        {
          slug: t.id,
          name: t.name,
          category: t.category ?? null,
          tag: t.tag ?? null,
          price_cop: t.price ?? null,
          price_unit: t.priceUnit ?? null,
          duration: t.duration ?? null,
          schedule_text: t.schedule ?? null,
          pickup_text: t.pickup ?? null,
          includes: t.includes ?? [],
          highlights: t.highlights ?? [],
          note: t.note ?? null,
          active: true,
        },
        { onConflict: 'slug' }
      )
      .select('id')
      .single();

    if (error) {
      console.error(`✗ ${t.id}: ${error.message}`);
      continue;
    }

    console.log(`✓ ${t.id} → ${tourRow.id}`);

    if (t.photo) {
      const localPath = path.join(repoRoot, 'site', t.photo);
      if (!fs.existsSync(localPath)) {
        console.warn(`  (foto no encontrada localmente: ${localPath}, se omite)`);
        continue;
      }
      const fileBuffer = fs.readFileSync(localPath);
      const ext = path.extname(t.photo);
      const storagePath = `${t.id}/primary${ext}`;

      const { error: uploadError } = await db.storage
        .from('tour-media')
        .upload(storagePath, fileBuffer, { upsert: true, contentType: mimeFromExt(ext) });

      if (uploadError) {
        console.error(`  ✗ subida de foto falló: ${uploadError.message}`);
        continue;
      }

      const { error: mediaError } = await db.from('tour_media').upsert(
        {
          tour_id: tourRow.id,
          storage_path: storagePath,
          is_primary: true,
          source: 'catalog',
        },
        { onConflict: 'tour_id,storage_path' }
      );
      if (mediaError) console.error(`  ✗ tour_media falló: ${mediaError.message}`);
      else console.log(`  ✓ foto subida: ${storagePath}`);
    }
  }

  console.log('Listo.');
}

function mimeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
