import * as Crypto from 'expo-crypto';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fallbackUuid(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += hex[(Math.random() * 4) | 8];
    else out += hex[(Math.random() * 16) | 0];
  }
  return out;
}

/** New random UUID v4 for local rows. */
export function newId(): string {
  const candidates = [
    () => globalThis.crypto?.randomUUID?.(),
    () => Crypto.randomUUID(),
  ];
  for (const candidate of candidates) {
    try {
      const value = candidate();
      if (typeof value === 'string' && UUID_PATTERN.test(value)) return value;
    } catch {
      // try the next source
    }
  }
  return fallbackUuid();
}
