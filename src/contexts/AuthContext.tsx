import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export interface UserPreferences {
  interfaceTheme?: {
    positive: string;
    negative: string;
    neutral: string;
    mode: 'flat' | 'gradient';
  };
  favoriteMetrics?: string[];
  dashboardChartOrder?: string[];
  dashboardMetricsOrder?: string[];
  [key: string]: unknown; // JSONB-like: allows future keys without schema changes
}

interface User {
  email: string;
  userId: string;
  firstName?: string;
  lastName?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => { success: boolean; error?: string };
  signup: (email: string, password: string, firstName?: string, lastName?: string) => { success: boolean; error?: string };
  logout: () => void;
  getPreferences: () => UserPreferences;
  updatePreferences: (update: Partial<UserPreferences>) => void;
  updateProfile: (update: { firstName?: string; lastName?: string; email?: string }) => { success: boolean; error?: string };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface StoredUser {
  email: string;
  password: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  preferences?: UserPreferences;
}

const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateUserId(existingIds: Set<string>): string {
  let id: string;
  do {
    id = '';
    for (let i = 0; i < 10; i++) {
      id += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
    }
  } while (existingIds.has(id));
  return id;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const session = localStorage.getItem('auth_session');
    if (session) {
      try {
        setUser(JSON.parse(session));
      } catch {
        localStorage.removeItem('auth_session');
      }
    }
  }, []);

  const getUsers = (): StoredUser[] => {
    try {
      return JSON.parse(localStorage.getItem('auth_users') || '[]');
    } catch {
      return [];
    }
  };

  const signup = useCallback((email: string, password: string, firstName?: string, lastName?: string) => {
    const users = getUsers();
    if (users.find(u => u.email === email)) {
      return { success: false, error: 'An account with this email already exists' };
    }
    const existingIds = new Set(users.map(u => u.userId).filter(Boolean));
    const userId = generateUserId(existingIds);
    const trimmedFirst = firstName?.trim() || undefined;
    const trimmedLast = lastName?.trim() || undefined;
    users.push({ email, password, userId, firstName: trimmedFirst, lastName: trimmedLast, preferences: {} });
    localStorage.setItem('auth_users', JSON.stringify(users));
    const userData: User = { email, userId, firstName: trimmedFirst, lastName: trimmedLast };
    localStorage.setItem('auth_session', JSON.stringify(userData));
    setUser(userData);
    return { success: true };
  }, []);

  const login = useCallback((email: string, password: string) => {
    const users = getUsers();
    const found = users.find(u => u.email === email && u.password === password);
    if (!found) {
      return { success: false, error: 'Invalid email or password' };
    }
    if (!found.userId) {
      const existingIds = new Set(users.map(u => u.userId).filter(Boolean));
      found.userId = generateUserId(existingIds);
      localStorage.setItem('auth_users', JSON.stringify(users));
    }
    const userData: User = { email, userId: found.userId, firstName: found.firstName, lastName: found.lastName };
    localStorage.setItem('auth_session', JSON.stringify(userData));
    setUser(userData);
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_session');
    setUser(null);
  }, []);

  const getPreferences = useCallback((): UserPreferences => {
    if (!user) return {};
    const users = getUsers();
    const found = users.find(u => u.userId === user.userId);
    return found?.preferences || {};
  }, [user]);

  const updatePreferences = useCallback((update: Partial<UserPreferences>) => {
    if (!user) return;
    const users = getUsers();
    const idx = users.findIndex(u => u.userId === user.userId);
    if (idx === -1) return;
    users[idx].preferences = { ...users[idx].preferences, ...update };
    localStorage.setItem('auth_users', JSON.stringify(users));
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, logout, getPreferences, updatePreferences }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
