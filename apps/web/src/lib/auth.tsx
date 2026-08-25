import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { api, clearToken, getToken, setToken } from "./api";

interface AuthCtx {
  authenticated: boolean;
  requestOtp: (phone?: string) => Promise<{ simulated: boolean; devCode?: string }>;
  verifyOtp: (code: string, phone?: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(() => Boolean(getToken()));

  const requestOtp = useCallback(async (phone?: string) => {
    return api.post<{ ok: boolean; simulated: boolean; devCode?: string }>(
      "/api/auth/request-otp",
      phone ? { phone } : {},
    );
  }, []);

  const verifyOtp = useCallback(async (code: string, phone?: string) => {
    const res = await api.post<{ token: string }>("/api/auth/verify-otp", { code, phone });
    setToken(res.token);
    setAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setAuthenticated(false);
    window.location.href = "/";
  }, []);

  return (
    <Ctx.Provider value={{ authenticated, requestOtp, verifyOtp, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
