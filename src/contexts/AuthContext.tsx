import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface User {
  email: string;
  userId: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => { success: boolean; error?: string };
  signup: (email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface StoredUser {
  email: string;
  password: string;
  userId: string;
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

  const signup = useCallback((email: string, password: string) => {
    const users = getUsers();
    if (users.find(u => u.email === email)) {
      return { success: false, error: 'An account with this email already exists' };
    }
    const existingIds = new Set(users.map(u => u.userId).filter(Boolean));
    const userId = generateUserId(existingIds);
    users.push({ email, password, userId });
    localStorage.setItem('auth_users', JSON.stringify(users));
    const userData = { email, userId };
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
    // Backfill userId for legacy users
    if (!found.userId) {
      const existingIds = new Set(users.map(u => u.userId).filter(Boolean));
      found.userId = generateUserId(existingIds);
      localStorage.setItem('auth_users', JSON.stringify(users));
    }
    const userData = { email, userId: found.userId };
    localStorage.setItem('auth_session', JSON.stringify(userData));
    setUser(userData);
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_session');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
