import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { api, ApiError, setUnauthorizedHandler, User } from './api';
import { clearToken, readToken, writeToken } from './tokenStore';

const TOKEN_KEY = 'safeflow.session';

type AuthState = {
  user: User | null;
  token: string | null;
  ready: boolean;
  // True after the server rejected the saved session (not after a normal logout), so screens can explain it.
  sessionEnded: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await readToken(TOKEN_KEY);
      if (saved) {
        try {
          setUser(await api<User>('/auth/me', { token: saved }));
          setToken(saved);
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) await clearToken(TOKEN_KEY);
        }
      }
      setReady(true);
    })();
  }, []);

  const finish = useCallback(async (res: { token: string; user: User }) => {
    await writeToken(TOKEN_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
    setSessionEnded(false);
  }, []);

  const login = useCallback(
    async (email: string, password: string) =>
      finish(await api('/auth/login', { method: 'POST', body: { email, password } })),
    [finish],
  );
  const register = useCallback(
    async (email: string, password: string) =>
      finish(await api('/auth/register', { method: 'POST', body: { email, password } })),
    [finish],
  );
  const logout = useCallback(async () => {
    await clearToken(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // A rejected session mid-use (account wiped on the server) signs the user out instead of leaving a dead login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSessionEnded(true);
      void logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, token, ready, sessionEnded, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
