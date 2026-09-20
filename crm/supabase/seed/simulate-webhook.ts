/**
 * Simula un webhook de Meta contra el servidor local, con la firma
 * X-Hub-Signature-256 correctamente calculada — para probar la ruta de
 * ingesta (normalización, creación de contacto/conversación/mensaje,
 * idempotencia) sin necesitar tráfico real de WhatsApp/Instagram/Messenger.
 *
 * Uso (con `npm run dev` corriendo en otra terminal):
 *   npm run simulate:webhook -- whatsapp-text
 *   npm run simulate:webhook -- whatsapp-text --repeat   # prueba idempotencia
 *   npm run simulate:webhook -- messenger-text
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

// Next.js usa .env.local para desarrollo; estos scripts standalone no pasan
// por Next, así que cargamos el mismo archivo explícitamente.
dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config(); // .env como respaldo

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const APP_SECRET = process.env.META_APP_SECRET;
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

async function main() {
  const fixtureName = process.argv[2];
  if (!fixtureName) {
    console.error('Uso: npm run simulate:webhook -- <fixture> [--repeat]');
    console.error('Fixtures disponibles:', fs.readdirSync(FIXTURES_DIR).join(', '));
    process.exit(1);
  }

  const fixturePath = path.join(FIXTURES_DIR, fixtureName.endsWith('.json') ? fixtureName : `${fixtureName}.json`);
  if (!fs.existsSync(fixturePath)) {
    console.error(`No existe el fixture: ${fixturePath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(fixturePath, 'utf8');

  await post(raw);

  if (process.argv.includes('--repeat')) {
    console.log('Reenviando el mismo payload para probar idempotencia (no debería crear un mensaje duplicado)…');
    await post(raw);
  }
}

async function post(raw: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (APP_SECRET) {
    const sig = crypto.createHmac('sha256', APP_SECRET).update(raw, 'utf8').digest('hex');
    headers['X-Hub-Signature-256'] = `sha256=${sig}`;
  } else {
    console.warn(
      'META_APP_SECRET no está definido en tu entorno — el webhook solo lo aceptará si tampoco tiene configurado META_APP_SECRET.'
    );
  }

  const res = await fetch(`${APP_URL}/api/webhooks/meta`, { method: 'POST', headers, body: raw });
  const text = await res.text();
  console.log(`→ ${res.status} ${text}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
