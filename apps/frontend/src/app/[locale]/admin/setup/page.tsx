'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import styles from './Setup.module.scss';

export default function AdminSetupPage() {
  const { register, hasUsers, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);
    const result = await register(username, email, password);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Registration failed');
    }
  };

  if (isLoading) {
    return (
      <div className={`${styles.container} relative bg-white`}>
        <div className={`${styles.anchor} absolute -top-[60px]`} id="content"></div>
        <div className={styles.card}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (hasUsers) {
    return (
      <div className={`${styles.container} relative bg-white`}>
        <div className={`${styles.anchor} absolute -top-[60px]`} id="content"></div>
        <div className={styles.card}>
          <h1 className={styles.title}>Setup Complete</h1>
          <p>An admin account already exists.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} relative bg-white`}>
      <div className={`${styles.anchor} absolute -top-[60px]`} id="content"></div>
      <div className={styles.card}>
        <h1 className={styles.title}>Create Admin Account</h1>
        <p className={styles.subtitle}>
          Welcome! Set up your admin account to get started.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="username" className={styles.required}>
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={30}
              autoComplete="username"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="email" className={styles.required}>
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.required}>
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="confirmPassword" className={styles.required}>
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            className={styles.button}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating Account...' : 'Create Admin Account'}
          </button>
        </form>
      </div>
    </div>
  );
}

