/* Global Jest mocks for native modules that have no Node implementation. */

jest.mock('expo-sqlite/kv-store', () => {
  const store = new Map<string, string>();
  const api = {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    getItemSync: (key: string) => store.get(key) ?? null,
    setItemSync: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItemSync: (key: string) => store.delete(key),
    clear: async () => store.clear(),
  };
  return { __esModule: true, default: api, Storage: api, AsyncStorage: api };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-symbols', () => {
  const { View } = jest.requireActual('react-native');
  return { SymbolView: View };
});
