'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/client';

export interface OwnerUser {
  id: string;
  email: string;
  role: string;
}

export interface OwnerSession {
  user: OwnerUser;
  csrf: string;
}

interface OwnerContextType {
  session: OwnerSession | null;
  loading: boolean;
  activeSection: string;
  setActiveSection: (sec: string) => void;
  refreshTrigger: number;
  refreshData: () => void;
  signOut: () => Promise<void>;
}

const OwnerContext = createContext<OwnerContextType | null>(null);

export function OwnerProvider({
  children,
  initialSection = 'overview',
}: {
  children: React.ReactNode;
  initialSection?: string;
}) {
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState(initialSection);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const sync = useCallback(async () => {
    try {
      const data = await api<any>('/v1/auth/me');
      if (data && data.user && data.user.role === 'owner') {
        if (data.csrf && typeof window !== 'undefined') {
          localStorage.setItem('auth_csrf', data.csrf);
        }
        setSession({
          user: data.user,
          csrf: data.csrf || '',
        });
      } else {
        setSession(null);
      }
    } catch {
      // Unauthenticated or expired session - user must sign in with verified credentials
      setSession(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_csrf');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void sync();
  }, [sync]);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const refreshData = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const signOut = async () => {
    try {
      await api('/v1/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_csrf');
    }
    setSession(null);
  };

  return (
    <OwnerContext.Provider
      value={{
        session,
        loading,
        activeSection,
        setActiveSection,
        refreshTrigger,
        refreshData,
        signOut,
      }}
    >
      {children}
    </OwnerContext.Provider>
  );
}

export function useOwner() {
  const ctx = useContext(OwnerContext);
  if (!ctx) throw new Error('useOwner must be used within an OwnerProvider');
  return ctx;
}
