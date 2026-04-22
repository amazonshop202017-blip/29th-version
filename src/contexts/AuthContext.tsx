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
  avatarDataUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => { success: boolean; error?: string };
  signup: (email: string, password: string, firstName?: string, lastName?: string) => { success: boolean; error?: string };
  logout: () => void;
  getPreferences: () => UserPreferences;
  updatePreferences: (update: Partial<UserPreferences>) => void;
  updateProfile: (update: { firstName?: string; lastName?: string; email?: string; avatarDataUrl?: string | null }) => { success: boolean; error?: string };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface StoredUser {
  email: string;
  password: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  avatarDataUrl?: string | null;
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
        const parsed = JSON.parse(session) as User;
        // Re-attach avatar from its dedicated key
        const avatar = parsed.userId ? localStorage.getItem(`auth_avatar_${parsed.userId}`) : null;
        setUser({ ...parsed, avatarDataUrl: avatar });
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
    const userData: User = { email, userId: found.userId, firstName: found.firstName, lastName: found.lastName, avatarDataUrl: found.avatarDataUrl ?? null };
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

  const updateProfile = useCallback((update: { firstName?: string; lastName?: string; email?: string; avatarDataUrl?: string | null }) => {
    if (!user) return { success: false, error: 'Not signed in' };
    const users = getUsers();
    const idx = users.findIndex(u => u.userId === user.userId);
    if (idx === -1) return { success: false, error: 'User not found' };

    const nextEmail = update.email?.trim() || users[idx].email;
    if (nextEmail !== users[idx].email && users.some((u, i) => i !== idx && u.email === nextEmail)) {
      return { success: false, error: 'An account with this email already exists' };
    }

    const nextFirst = update.firstName !== undefined ? update.firstName.trim() || undefined : users[idx].firstName;
    const nextLast = update.lastName !== undefined ? update.lastName.trim() || undefined : users[idx].lastName;

    // Persist avatar in its own key per user so it never bloats the users list
    let nextAvatar: string | null | undefined = users[idx].avatarDataUrl;
    if (update.avatarDataUrl !== undefined) {
      nextAvatar = update.avatarDataUrl;
      try {
        if (update.avatarDataUrl) {
          localStorage.setItem(`auth_avatar_${user.userId}`, update.avatarDataUrl);
        } else {
          localStorage.removeItem(`auth_avatar_${user.userId}`);
        }
      } catch (err) {
        return { success: false, error: 'Image too large to save. Try a smaller picture.' };
      }
    }

    users[idx] = { ...users[idx], email: nextEmail, firstName: nextFirst, lastName: nextLast };
    // Do NOT store avatar inside the users list (keeps it small)
    delete (users[idx] as { avatarDataUrl?: unknown }).avatarDataUrl;
    try {
      localStorage.setItem('auth_users', JSON.stringify(users));
    } catch {
      return { success: false, error: 'Could not save profile (storage full)' };
    }

    const userData: User = { email: nextEmail, userId: user.userId, firstName: nextFirst, lastName: nextLast, avatarDataUrl: nextAvatar ?? null };
    try {
      // Session never includes the avatar data URL (kept lightweight)
      const sessionData = { email: nextEmail, userId: user.userId, firstName: nextFirst, lastName: nextLast };
      localStorage.setItem('auth_session', JSON.stringify(sessionData));
    } catch {
      /* non-fatal */
    }
    setUser(userData);
    return { success: true };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, logout, getPreferences, updatePreferences, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
