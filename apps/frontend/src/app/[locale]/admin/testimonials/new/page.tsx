'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TestimonialForm from '@/components/admin/TestimonialForm';
import styles from '../Testimonials.module.scss';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

export default function NewTestimonialPage() {
  const { isLoading: authLoading, isLoggedIn } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (testimonialData: Record<string, unknown>) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/admin/testimonials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(testimonialData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create testimonial');
      }

      router.push('/admin/testimonials');
    } catch (err) {
      console.error('Error creating testimonial:', err);
      setError(err instanceof Error ? err.message : 'Failed to create testimonial');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
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
        <div className={styles.headerLeft}>
          <Link href="/admin/testimonials" className={styles.backLink}>
            ← Back to Testimonials
          </Link>
          <h1 className={styles.title}>New Testimonial</h1>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <TestimonialForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
}

