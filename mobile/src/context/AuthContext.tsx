import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  hasActiveSession,
  hasAdminPassword,
  setAdminPassword,
  startSession,
  endSession,
  verifyAdminPassword,
} from "../auth/localAuth";

interface AuthUser {
  role: "ADMIN";
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  needsSetup: boolean;
  setup: (password: string) => Promise<void>;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [hasPassword, sessionActive] = await Promise.all([
        hasAdminPassword(),
        hasActiveSession(),
      ]);
      setNeedsSetup(!hasPassword);
      if (hasPassword && sessionActive) {
        setUser({ role: "ADMIN" });
      }
      setIsLoading(false);
    })();
  }, []);

  const setup = async (password: string) => {
    await setAdminPassword(password);
    await startSession();
    setNeedsSetup(false);
    setUser({ role: "ADMIN" });
  };

  const login = async (password: string) => {
    const valid = await verifyAdminPassword(password);
    if (!valid) {
      throw new Error("Incorrect password");
    }
    await startSession();
    setUser({ role: "ADMIN" });
  };

  const logout = async () => {
    await endSession();
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, isLoading, needsSetup, setup, login, logout }),
    [user, isLoading, needsSetup]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
