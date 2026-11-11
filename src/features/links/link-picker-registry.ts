/**
 * Module-level promise registry connecting `useLinkPicker()` callers with the `links/picker`
 * modal. Each request is keyed by an id passed as a route param; the modal resolves it with the
 * chosen item, or with null when it is dismissed or unmounted.
 */
import { LINKABLE_TYPES, type LinkableType } from '@/db/schema';

import type { EntityRef } from './resolve';

export interface LinkTarget {
  type: LinkableType;
  id: string;
  title: string;
}

/** Types offered by the picker by default (PRD §6.4: sermons, prayers, entries, action items). */
export const DEFAULT_PICKER_TYPES: readonly LinkableType[] = ['sermon', 'journal_entry', 'prayer_entry', 'action_item'];

const pending = new Map<string, (target: LinkTarget | null) => void>();

/** Register a request and get a promise that settles when the picker resolves it. */
export function openLinkRequest(requestId: string): Promise<LinkTarget | null> {
  pending.get(requestId)?.(null);
  return new Promise((resolve) => {
    pending.set(requestId, resolve);
  });
}

/** Settle a request. Returns false if it was already settled (or never existed). */
export function resolveLinkRequest(requestId: string, target: LinkTarget | null): boolean {
  const resolve = pending.get(requestId);
  if (!resolve) return false;
  pending.delete(requestId);
  resolve(target);
  return true;
}

export function isLinkRequestPending(requestId: string): boolean {
  return pending.has(requestId);
}

// ---------------------------------------------------------------------------
// Route params (strings only) ⇄ picker options
// ---------------------------------------------------------------------------

export interface LinkPickerOptions {
  /** The item being linked from; never offered as a result. */
  exclude?: EntityRef;
  types?: readonly LinkableType[];
  /** Header title, e.g. "Link a sermon". */
  title?: string;
}

export interface LinkPickerRequest {
  requestId: string;
  exclude: EntityRef | null;
  types: readonly LinkableType[];
  title: string;
}

export type LinkPickerParams = Record<string, string>;

const ID_PATTERN = /^[\w-]{1,64}$/;
const MAX_TITLE_LENGTH = 60;

function isLinkableType(value: unknown): value is LinkableType {
  return typeof value === 'string' && (LINKABLE_TYPES as readonly string[]).includes(value);
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function toLinkPickerParams(requestId: string, options: LinkPickerOptions = {}): LinkPickerParams {
  return {
    requestId,
    ...(options.exclude ? { excludeType: options.exclude.type, excludeId: options.exclude.id } : {}),
    ...(options.types && options.types.length > 0 ? { types: options.types.join(',') } : {}),
    ...(options.title ? { title: options.title } : {}),
  };
}

/** Validate untrusted route params; returns null when the request id is missing or malformed. */
export function parseLinkPickerParams(params: Record<string, string | string[] | undefined>): LinkPickerRequest | null {
  const requestId = single(params.requestId);
  if (!requestId || !ID_PATTERN.test(requestId)) return null;

  const excludeType = single(params.excludeType);
  const excludeId = single(params.excludeId);
  const exclude = isLinkableType(excludeType) && excludeId && ID_PATTERN.test(excludeId) ? { type: excludeType, id: excludeId } : null;

  const requested = (single(params.types) ?? '').split(',').filter(isLinkableType);
  const types = requested.length > 0 ? [...new Set(requested)] : DEFAULT_PICKER_TYPES;

  const title = (single(params.title) ?? '').trim().slice(0, MAX_TITLE_LENGTH) || 'Link';
  return { requestId, exclude, types, title };
}
