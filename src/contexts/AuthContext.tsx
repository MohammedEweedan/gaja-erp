import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import axios from 'axios';

type RawUser = {
  ps?: any;
  id_user?: any;
  Action_user?: any;
  Roles?: any;
  name_user?: string;
};

type StoredUser = {
  id: string;                 // email as id (your legacy login stores this)
  ps?: any;
  Cuser?: any;                // id_user
  roles?: any;                // Users.Roles (preferred) or legacy Action_user
  name_user?: string;
};

export interface User {
  id: string;
  email: string;
  name: string;               // normalized for UI
  role?: string;              // first role if available
  // legacy / domain-specific fields (kept so the rest of the app keeps working)
  ps?: any;
  Cuser?: any;
  roles?: any;
  name_user?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  // (Optional) overload if some screens use object args:
  // login: (payload: { identifier: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  logout: (onSuccess?: () => void) => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USER_KEY = 'user';
const TOKEN_KEY = 'token';
const BASE_URL = process.env.REACT_APP_API_IP;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate from localStorage like your legacy flow
  useEffect(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      const token = localStorage.getItem(TOKEN_KEY);

      if (stored && token) {
        const legacy: StoredUser = JSON.parse(stored);
        // Normalize to rich User for UI
        const normalized: User = {
          id: legacy.id,
          email: legacy.id, // your legacy stored only email in `id`
          name: legacy.name_user || legacy.id?.split('@')?.[0] || 'User',
          role: Array.isArray(legacy.roles) ? legacy.roles[0] : legacy.roles,
          ps: legacy.ps,
          Cuser: legacy.Cuser,
          roles: legacy.roles,
          name_user: legacy.name_user,
        };
        setUser(normalized);
      }
    } catch (e) {
      console.error('Failed to parse stored user', e);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      // Real API call (exactly like your page)
      const res = await axios.post(
        `${BASE_URL}/api/login`,
        { email, password },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const token: string | undefined = res?.data?.token;
  const backendUser: RawUser | undefined = res?.data?.user;

      if (!token || !backendUser) {
        return { success: false, error: 'Invalid credentials response' };
      }

      // Persist token for interceptors/protected routes
      localStorage.setItem(TOKEN_KEY, token);

      // Persist “legacy” user shape — this is what your existing code expects
      const storedUser: StoredUser = {
        id: email,
        ps: backendUser.ps,
        Cuser: backendUser.id_user,
        roles: (backendUser as any)?.Roles ?? backendUser.Action_user,
        name_user: backendUser.name_user,
      };
      localStorage.setItem(USER_KEY, JSON.stringify(storedUser));

      // Also keep a normalized user in state for nicer UI usage
      const normalized: User = {
        id: email,
        email,
        name: backendUser.name_user || email.split('@')[0],
        role: Array.isArray(storedUser.roles) ? storedUser.roles[0] : storedUser.roles,
        ps: storedUser.ps,
        Cuser: storedUser.Cuser,
        roles: storedUser.roles,
        name_user: storedUser.name_user,
      };
      setUser(normalized);

      return { success: true };
    } catch (error: any) {
      console.error('Login failed:', error);
      return {
        success: false,
        error: error?.response?.data?.message || error?.message || 'Login failed',
      };
    }
  }, []);

  const logout = useCallback((onSuccess?: () => void) => {
    setUser(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    onSuccess?.();
  }, []);

  const value: AuthContextType = {
    user,
    login,
    logout,
    isAuthenticated: !!user && !!localStorage.getItem(TOKEN_KEY),
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export default AuthContext;
