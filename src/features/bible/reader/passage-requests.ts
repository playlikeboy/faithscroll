import type { VerseRange } from '../types';

/**
 * Module-level registry connecting `usePassagePicker()` callers with the
 * `bible/passage-picker` modal. The request id travels as a route param;
 * each request resolves exactly once (a range, or null when cancelled).
 */
type Resolver = (range: VerseRange | null) => void;

const pending = new Map<string, Resolver>();
let sequence = 0;

export interface PassageRequest {
  id: string;
  promise: Promise<VerseRange | null>;
}

export function createPassageRequest(): PassageRequest {
  sequence += 1;
  const id = `passage-${Date.now().toString(36)}-${sequence}`;
  const promise = new Promise<VerseRange | null>((resolve) => {
    pending.set(id, resolve);
  });
  return { id, promise };
}

/** Resolve a pending request. Returns false when it is unknown or already settled. */
export function resolvePassageRequest(id: string, range: VerseRange | null): boolean {
  const resolve = pending.get(id);
  if (!resolve) return false;
  pending.delete(id);
  resolve(range);
  return true;
}

export function cancelPassageRequest(id: string): boolean {
  return resolvePassageRequest(id, null);
}

export function hasPendingPassageRequest(id: string): boolean {
  return pending.has(id);
}
