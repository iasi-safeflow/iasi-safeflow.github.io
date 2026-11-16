import { readToken, writeToken } from './tokenStore';

const DEVICE_KEY = 'safeflow.device';
let cachedId: string | null = null;

function generateId(): string {
  const rand = Math.random().toString(36).slice(2, 12);
  const rand2 = Math.random().toString(36).slice(2, 10);
  return `sf-${Date.now().toString(36)}-${rand}${rand2}`;
}

export async function getDeviceId(): Promise<string> {
  if (cachedId) return cachedId;
  const existing = await readToken(DEVICE_KEY);
  if (existing && /^[A-Za-z0-9._-]{8,128}$/.test(existing)) {
    cachedId = existing;
    return existing;
  }
  const fresh = generateId();
  cachedId = fresh;
  await writeToken(DEVICE_KEY, fresh);
  return fresh;
}
