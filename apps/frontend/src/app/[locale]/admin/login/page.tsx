'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import styles from './Login.module.scss';

export default function AdminLoginPage() {
  const { login, loginWithPasskey, isLoading, hasUsers } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await login(username, password);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Login failed');
    }
  };

  const handlePasskeyLogin = async () => {
    setError('');
    setIsSubmitting(true);

    const result = await loginWithPasskey(username || undefined);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Passkey login failed');
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasUsers) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>No Admin Account</h1>
          <p>Please set up an admin account first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Admin Login</h1>
        <p className={styles.subtitle}>Sign in to access the admin panel.</p>

        <form onSubmit={handlePasswordLogin} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="username">Username or Email</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            className={styles.button}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <button
          type="button"
          className={styles.passkeyButton}
          onClick={handlePasskeyLogin}
          disabled={isSubmitting}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z" />
            <circle cx="16.5" cy="7.5" r=".5" />
          </svg>
          Sign in with Passkey
        </button>
      </div>
    </div>
  );
}

