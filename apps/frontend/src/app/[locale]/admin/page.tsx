'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import styles from './Admin.module.scss';

export default function AdminDashboardPage() {
  const { user, logout, registerPasskey, isLoading, isLoggedIn } = useAuth();
  const [passkeyStatus, setPasskeyStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [isRegistering, setIsRegistering] = useState(false);

  const handleRegisterPasskey = async () => {
    setPasskeyStatus({ type: null, message: '' });
    setIsRegistering(true);

    const result = await registerPasskey();
    setIsRegistering(false);

    if (result.success) {
      setPasskeyStatus({
        type: 'success',
        message: 'Passkey registered successfully! You can now use it to log in.',
      });
    } else {
      setPasskeyStatus({
        type: 'error',
        message: result.error || 'Failed to register passkey',
      });
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

  if (!isLoggedIn) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Access Denied</h1>
          <p>Please log in to access the admin panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Admin Dashboard</h1>
        <button onClick={logout} className={styles.logoutButton}>
          Sign Out
        </button>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Welcome, {user?.username}!</h2>
          <p className={styles.cardText}>
            You are logged in as <strong>{user?.email}</strong>
          </p>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Security</h2>
          <p className={styles.cardText}>
            Add a passkey for faster and more secure sign-in.
          </p>

          {passkeyStatus.type && (
            <p
              className={
                passkeyStatus.type === 'success' ? styles.success : styles.error
              }
            >
              {passkeyStatus.message}
            </p>
          )}

          <button
            onClick={handleRegisterPasskey}
            className={styles.button}
            disabled={isRegistering}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
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
            {isRegistering ? 'Registering...' : 'Register Passkey'}
          </button>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Your Profile</h2>
          <p className={styles.cardText}>
            Edit your name, bio, skills, and contact information.
          </p>
          <Link href="/admin/profile" className={styles.button}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Edit Profile
          </Link>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Content Management</h2>
          <p className={styles.cardText}>
            Manage your portfolio content, projects, and testimonials.
          </p>
          <div className={styles.buttonGroup}>
            <Link href="/admin/projects" className={styles.button}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              Manage Projects
            </Link>
            <Link href="/admin/testimonials" className={styles.button}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Manage Testimonials
            </Link>
            <Link href="/admin/resumes" className={styles.button}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Manage Resumes
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

