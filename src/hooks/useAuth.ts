import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  getSession,
  clearSession,
  isSessionValid,
  ADMIN_USER_ID,
  type AdminSession,
} from '@/lib/adminAuth';

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  notification_preferences: {
    browserNotifications: boolean;
    emailNotifications: boolean;
  };
  created_at: string;
  updated_at: string;
}

export function useAuth() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const s = getSession();
    setSession(s);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    clearSession();
    setSession(null);
    toast.info('Sessão encerrada com sucesso');
    navigate('/login');
  }, [navigate]);

  // Stub kept for backwards compatibility — no-op in admin mode
  const signIn = useCallback(async (_email: string, _password: string) => {
    return { data: null, error: null };
  }, []);

  const signUp = useCallback(async (_email: string, _password: string, _displayName?: string) => {
    return { data: null, error: new Error('Cadastro não permitido') };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    toast.error('Login social não disponível');
    return { data: null, error: new Error('Not available') };
  }, []);

  const signInWithGithub = useCallback(async () => {
    toast.error('Login social não disponível');
    return { data: null, error: new Error('Not available') };
  }, []);

  const updateProfile = useCallback(async (_updates: Partial<Pick<Profile, 'display_name' | 'avatar_url' | 'notification_preferences'>>) => {
    return { error: null };
  }, []);

  const isAuthenticated = isSessionValid();

  const user = isAuthenticated
    ? {
        id: ADMIN_USER_ID,
        email: session?.email ?? 'ferramentastech.apps@gmail.com',
        user_metadata: { full_name: 'Admin' },
      }
    : null;

  return {
    user,
    session,
    profile: null as Profile | null,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithGithub,
    signOut,
    updateProfile,
    isAuthenticated,
  };
}
