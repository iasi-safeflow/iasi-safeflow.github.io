import * as SecureStore from 'expo-secure-store';

// Native: the session token lives in the OS keystore. tokenStore.web.ts is the browser counterpart.

export const readToken = (key: string) => SecureStore.getItemAsync(key);
export const writeToken = (key: string, value: string) => SecureStore.setItemAsync(key, value);
export const clearToken = (key: string) => SecureStore.deleteItemAsync(key);
