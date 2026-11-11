/**
 * Web-only stand-in for `expo-sqlite/kv-store` (wired in metro.config.js for platform "web").
 *
 * On web, expo-sqlite's key-value store runs through the SQLite WebAssembly worker and its
 * promises never settle in the dev preview, which left persisted Zustand stores (preferences,
 * sync, reminders…) un-hydrated and the app blank. The preview only needs simple string storage,
 * so this keeps the same API surface on top of `localStorage`. iOS and Android use the real store.
 */
type UpdateFunction = (previous: string | null) => string;

const PREFIX = 'faithscroll.kv.';

function backend(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null; // e.g. storage disabled in a private window
  }
}

function keysWithPrefix(storage: Storage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  return keys;
}

class WebKeyValueStore {
  getItemSync(key: string): string | null {
    return backend()?.getItem(PREFIX + key) ?? null;
  }

  setItemSync(key: string, value: string | UpdateFunction): void {
    const storage = backend();
    if (!storage) return;
    const next = typeof value === 'function' ? value(storage.getItem(PREFIX + key)) : value;
    storage.setItem(PREFIX + key, next);
  }

  removeItemSync(key: string): boolean {
    const storage = backend();
    if (!storage || storage.getItem(PREFIX + key) === null) return false;
    storage.removeItem(PREFIX + key);
    return true;
  }

  getAllKeysSync(): string[] {
    const storage = backend();
    return storage ? keysWithPrefix(storage).map((key) => key.slice(PREFIX.length)) : [];
  }

  clearSync(): boolean {
    const storage = backend();
    if (!storage) return false;
    keysWithPrefix(storage).forEach((key) => storage.removeItem(key));
    return true;
  }

  async getItem(key: string): Promise<string | null> {
    return this.getItemSync(key);
  }

  async getItemAsync(key: string): Promise<string | null> {
    return this.getItemSync(key);
  }

  async setItem(key: string, value: string | UpdateFunction): Promise<void> {
    this.setItemSync(key, value);
  }

  async setItemAsync(key: string, value: string | UpdateFunction): Promise<void> {
    this.setItemSync(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.removeItemSync(key);
  }

  async removeItemAsync(key: string): Promise<boolean> {
    return this.removeItemSync(key);
  }

  async getAllKeys(): Promise<string[]> {
    return this.getAllKeysSync();
  }

  async getAllKeysAsync(): Promise<string[]> {
    return this.getAllKeysSync();
  }

  async clear(): Promise<void> {
    this.clearSync();
  }

  async clearAsync(): Promise<boolean> {
    return this.clearSync();
  }
}

const store = new WebKeyValueStore();

export const Storage = store;
export const AsyncStorage = store;
export default store;
