'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthStatus {
  hasUsers: boolean;
  isLoggedIn: boolean;
  user: User | null;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  hasUsers: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  registerPasskey: () => Promise<{ success: boolean; error?: string }>;
  loginWithPasskey: (username?: string) => Promise<{ success: boolean; error?: string }>;
  checkStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasUsers, setHasUsers] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/auth/status`, {
        credentials: 'include',
      });
      const data: AuthStatus = await response.json();
      
      setHasUsers(data.hasUsers);
      setIsLoggedIn(data.isLoggedIn);
      setUser(data.user);
    } catch (error) {
      console.error('Failed to check auth status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Handle redirects based on auth state
  useEffect(() => {
    if (isLoading) return;

    const isAdminRoute = pathname?.includes('/admin');
    const isSetupRoute = pathname?.includes('/admin/setup');
    const isLoginRoute = pathname?.includes('/admin/login');

    // If no users exist and not on setup page, redirect to setup
    if (!hasUsers && !isSetupRoute) {
      const locale = pathname?.split('/')[1] || 'en';
      router.push(`/${locale}/admin/setup`);
      return;
    }

    // If users exist but not logged in, and trying to access admin (not login), redirect to login
    if (hasUsers && !isLoggedIn && isAdminRoute && !isLoginRoute && !isSetupRoute) {
      const locale = pathname?.split('/')[1] || 'en';
      router.push(`/${locale}/admin/login`);
      return;
    }

    // If logged in and on login/setup page, redirect to admin dashboard
    if (isLoggedIn && (isLoginRoute || isSetupRoute)) {
      const locale = pathname?.split('/')[1] || 'en';
      router.push(`/${locale}/admin`);
      return;
    }
  }, [isLoading, hasUsers, isLoggedIn, pathname, router]);

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }

      setUser(data.user);
      setIsLoggedIn(true);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      setUser(data.user);
      setIsLoggedIn(true);
      setHasUsers(true);
      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsLoggedIn(false);
      const locale = pathname?.split('/')[1] || 'en';
      router.push(`/${locale}/admin/login`);
    }
  };

  const registerPasskey = async () => {
    try {
      // Get registration options
      const optionsResponse = await fetch(`${API_URL}/auth/passkey/register-options`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!optionsResponse.ok) {
        return { success: false, error: 'Failed to get registration options' };
      }

      const options = await optionsResponse.json();

      // Start WebAuthn registration
      const attestation = await startRegistration({ optionsJSON: options });

      // Verify registration
      const verifyResponse = await fetch(`${API_URL}/auth/passkey/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(attestation),
      });

      if (!verifyResponse.ok) {
        return { success: false, error: 'Failed to register passkey' };
      }

      return { success: true };
    } catch (error) {
      console.error('Passkey registration error:', error);
      return { success: false, error: 'Passkey registration failed' };
    }
  };

  const loginWithPasskey = async (username?: string) => {
    try {
      // Get authentication options
      const optionsResponse = await fetch(`${API_URL}/auth/passkey/login-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username }),
      });

      if (!optionsResponse.ok) {
        return { success: false, error: 'Failed to get authentication options' };
      }

      const { options } = await optionsResponse.json();

      // Start WebAuthn authentication
      const assertion = await startAuthentication({ optionsJSON: options });

      // Verify authentication
      const verifyResponse = await fetch(`${API_URL}/auth/passkey/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, response: assertion }),
      });

      const data = await verifyResponse.json();

      if (!verifyResponse.ok) {
        return { success: false, error: data.error || 'Passkey login failed' };
      }

      setUser(data.user);
      setIsLoggedIn(true);
      return { success: true };
    } catch (error) {
      console.error('Passkey login error:', error);
      return { success: false, error: 'Passkey login failed' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn,
        hasUsers,
        isLoading,
        login,
        register,
        logout,
        registerPasskey,
        loginWithPasskey,
        checkStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

