'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import TestimonialForm from '@/components/admin/TestimonialForm';
import styles from '../../Testimonials.module.scss';

interface LocalizedString {
  en: string;
  es: string;
  pt: string;
}

interface Testimonial {
  _id: string;
  key: string;
  author: string;
  url: string;
  quote: LocalizedString;
  role?: LocalizedString;
  connection: LocalizedString;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

export default function EditTestimonialPage() {
  const { isLoading: authLoading, isLoggedIn } = useAuth();
  const router = useRouter();
  const params = useParams();
  const testimonialKey = params.key as string;

  const [testimonial, setTestimonial] = useState<Testimonial | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTestimonial = async () => {
      try {
        const response = await fetch(`${API_URL}/testimonials/${testimonialKey}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Testimonial not found');
        }

        const data = await response.json();
        setTestimonial(data.testimonial);
      } catch (err) {
        console.error('Error fetching testimonial:', err);
        setError('Failed to load testimonial');
      } finally {
        setIsLoading(false);
      }
    };

    if (isLoggedIn && testimonialKey) {
      fetchTestimonial();
    }
  }, [isLoggedIn, testimonialKey]);

  const handleSubmit = async (testimonialData: Record<string, unknown>) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/admin/testimonials/${testimonialKey}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(testimonialData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update testimonial');
      }

      router.push('/admin/testimonials');
    } catch (err) {
      console.error('Error updating testimonial:', err);
      setError(err instanceof Error ? err.message : 'Failed to update testimonial');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) {
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

  if (!testimonial) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Testimonial Not Found</h1>
          <p>The testimonial you are looking for does not exist.</p>
          <Link href="/admin/testimonials" className={styles.backLink}>
            ← Back to Testimonials
          </Link>
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
          <h1 className={styles.title}>Edit: {testimonial.author}</h1>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <TestimonialForm
        initialData={testimonial}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        isEditMode
      />
    </div>
  );
}

