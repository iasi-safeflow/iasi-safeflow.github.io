// Web: SecureStore is unavailable, so the token is kept in localStorage. Any script on the page can read it
// (XSS exposure); acceptable for the test-account demo only. Storage can be blocked (private mode), so fail soft.

export async function readToken(key: string): Promise<string | null> {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function writeToken(key: string, value: string): Promise<void> {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Session still works until the tab is reloaded.
  }
}

export async function clearToken(key: string): Promise<void> {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing stored.
  }
}
