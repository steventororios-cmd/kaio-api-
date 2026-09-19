// Web Crypto API (no Node's `crypto` module) so this also works from the
// Edge runtime used by proxy.ts (Next.js middleware/proxy).

export const SESSION_COOKIE = 'crm_session';
const SESSION_PAYLOAD = 'owner';

function secret(): string {
  return process.env.SESSION_SECRET || 'dev-secret-change-me';
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sign(value: string): Promise<string> {
  const key = await hmacKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return toHex(sig);
}

export async function createSessionCookieValue(): Promise<string> {
  return `${SESSION_PAYLOAD}.${await sign(SESSION_PAYLOAD)}`;
}

export async function isValidSession(value: string | undefined | null): Promise<boolean> {
  if (!value) return false;
  const [payload, sig] = value.split('.');
  if (!payload || !sig) return false;
  const expected = await sign(payload);
  return expected === sig;
}
