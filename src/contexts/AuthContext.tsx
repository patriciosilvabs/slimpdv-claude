import * as React from 'react';
import { authApi, client } from '@/integrations/api/client';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenant_id?: string;
}

interface AuthSession {
  user: AuthUser;
  access_token: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Initialize auth state from stored token
  React.useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          client.setToken(token);
          const response = await authApi.getCurrentUser();
          if (response.user) {
            setUser(response.user);
            setSession({
              user: response.user,
              access_token: token,
            });
          }
        }
      } catch (err) {
        console.error('Failed to restore auth session:', err);
        authApi.logout();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const signIn = React.useCallback(async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);
      setUser(response.user);
      setSession({
        user: response.user,
        access_token: response.token,
      });
      return { error: null };
    } catch (err: any) {
      const error = new Error(err.message || 'Login failed');
      return { error };
    }
  }, []);

  const signUp = React.useCallback(async (email: string, password: string, name: string) => {
    try {
      const response = await authApi.register(email, password, name);
      setUser(response.user);
      setSession({
        user: response.user,
        access_token: response.token,
      });
      return { error: null };
    } catch (err: any) {
      const error = new Error(err.message || 'Registration failed');
      return { error };
    }
  }, []);

  const signOut = React.useCallback(async () => {
    authApi.logout();
    setUser(null);
    setSession(null);
  }, []);

  const value = React.useMemo<AuthContextType>(() => ({
    user, session, loading, signIn, signUp, signOut
  }), [user, session, loading, signIn, signUp, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
