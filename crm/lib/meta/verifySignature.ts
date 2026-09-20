import crypto from 'node:crypto';

/**
 * Verifica el header `X-Hub-Signature-256` que Meta envía en cada webhook,
 * calculado como HMAC-SHA256 del body crudo (sin parsear) usando el App
 * Secret de tu Meta App. Requiere el runtime Node.js (no Edge) por el uso
 * de `node:crypto`.
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader) return false;
  const [algo, hash] = signatureHeader.split('=');
  if (algo !== 'sha256' || !hash) return false;

  const expected = crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  if (expected.length !== hash.length) return false;

  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(hash, 'hex'));
}
