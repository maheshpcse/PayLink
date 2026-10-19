import { createHash, createHmac, randomBytes, timingSafeEqual, randomUUID, scrypt as nodeScrypt } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(nodeScrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, salt, hash] = storedHash.split(':');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

export function hashRequest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function newId(): string {
  return randomUUID();
}

export function correlationIdFrom(value: string | undefined): string {
  if (value && /^[A-Za-z0-9._:-]{1,100}$/.test(value)) return value;
  return randomUUID();
}

export function verifyWebhookSignature(rawBody: Buffer, header: string | undefined, secret: string): boolean {
  if (!header) return false;
  const supplied = header.startsWith('sha256=') ? header.slice('sha256='.length) : header;
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const left = Buffer.from(supplied, 'hex');
  const right = Buffer.from(expected, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}
