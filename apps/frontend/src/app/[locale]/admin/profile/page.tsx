'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import styles from './Profile.module.scss';

// Debounce helper
function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Dynamic import for markdown editor to avoid SSR issues
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
);

interface LocalizedString {
  en: string;
  es: string;
  pt: string;
}

interface ProfileData {
  name: LocalizedString;
  blurb: LocalizedString;
  role: LocalizedString;
  company?: LocalizedString;
  keywords: string[];
  profileImageUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

const emptyLocalizedString = (): LocalizedString => ({
  en: '',
  es: '',
  pt: '',
});

const LANGUAGES = ['en', 'es', 'pt'] as const;
const LANGUAGE_LABELS = {
  en: 'English',
  es: 'Español',
  pt: 'Português',
};

export default function AdminProfilePage() {
  const { isLoading: authLoading, isLoggedIn } = useAuth();
  const [activeTab, setActiveTab] = useState<'en' | 'es' | 'pt'>('en');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [keywordsInput, setKeywordsInput] = useState('');

  const [formData, setFormData] = useState<ProfileData>({
    name: emptyLocalizedString(),
    blurb: emptyLocalizedString(),
    role: emptyLocalizedString(),
    company: emptyLocalizedString(),
    keywords: [],
    profileImageUrl: '',
    linkedinUrl: '',
    githubUrl: '',
    websiteUrl: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: '',
  });

  // Profile image upload state
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Keyword autocomplete state
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  // Copy language content state
  const [copyFromLang, setCopyFromLang] = useState<'en' | 'es' | 'pt'>('en');
  const [copyToLang, setCopyToLang] = useState<'en' | 'es' | 'pt'>('es');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_URL}/profile`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }

        const data = await response.json();
        if (data.profile) {
          setFormData({
            name: data.profile.name || emptyLocalizedString(),
            blurb: data.profile.blurb || emptyLocalizedString(),
            role: data.profile.role || emptyLocalizedString(),
            company: data.profile.company || emptyLocalizedString(),
            keywords: data.profile.keywords || [],
            profileImageUrl: data.profile.profileImageUrl || '',
            linkedinUrl: data.profile.linkedinUrl || '',
            githubUrl: data.profile.githubUrl || '',
            websiteUrl: data.profile.websiteUrl || '',
            email: data.profile.email || '',
            phone: data.profile.phone || '',
            address: data.profile.address || '',
            city: data.profile.city || '',
            state: data.profile.state || '',
            zip: data.profile.zip || '',
            country: data.profile.country || '',
          });
          // Keywords are now stored directly in formData.keywords, input is just for typing
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    if (isLoggedIn) {
      fetchProfile();
    }
  }, [isLoggedIn]);

  // Debounced fetch for autocomplete suggestions
  const fetchAutocompleteSuggestions = useCallback(
    async (query: string) => {
      try {
        const response = await fetch(
          `${API_URL}/autocomplete/suggestions?q=${encodeURIComponent(query)}`
        );
        if (response.ok) {
          const data = await response.json();
          const suggestions = data.suggestions || [];
          
          // Filter out already selected keywords
          const filtered = suggestions.filter(
            (s: string) => !formData.keywords.some((k) => k.toLowerCase() === s.toLowerCase())
          );
          
          setFilteredSuggestions(filtered);
          setShowSuggestions(filtered.length > 0 && query.trim().length > 0);
        }
      } catch (error) {
        console.error('Error fetching autocomplete suggestions:', error);
      }
    },
    [formData.keywords]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedFetchSuggestions = useCallback(
    debounce((query: string) => {
      fetchAutocompleteSuggestions(query);
    }, 300),
    [fetchAutocompleteSuggestions]
  );

  const handleLocalizedChange = (
    field: 'name' | 'blurb' | 'role' | 'company',
    lang: keyof LocalizedString,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: {
        ...(prev[field] || emptyLocalizedString()),
        [lang]: value,
      },
    }));
  };

  const handleChange = (field: keyof ProfileData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Add a keyword as a pill
  const addKeyword = (keyword: string) => {
    const trimmed = keyword.trim();
    if (trimmed && !formData.keywords.some((k) => k.toLowerCase() === trimmed.toLowerCase())) {
      setFormData((prev) => ({
        ...prev,
        keywords: [...prev.keywords, trimmed],
      }));
    }
    setKeywordsInput('');
    setShowSuggestions(false);
    setFilteredSuggestions([]);
    setSelectedSuggestionIndex(-1);
  };

  // Remove a keyword pill
  const removeKeyword = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      keywords: prev.keywords.filter((_, i) => i !== index),
    }));
  };

  const handleKeywordsInputChange = (value: string) => {
    // Check if user typed a comma - if so, add the keyword as a pill
    if (value.includes(',')) {
      const parts = value.split(',');
      // Add all complete parts as pills
      parts.slice(0, -1).forEach((part) => {
        const trimmed = part.trim();
        if (trimmed) {
          addKeyword(trimmed);
        }
      });
      // Keep the last part (after the last comma) in the input
      setKeywordsInput(parts[parts.length - 1]);
      return;
    }

    setKeywordsInput(value);
    const currentWord = value.trim();
    
    if (currentWord.length > 0) {
      debouncedFetchSuggestions(currentWord);
      setSelectedSuggestionIndex(-1);
    } else {
      setShowSuggestions(false);
      setFilteredSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    addKeyword(suggestion);
  };

  const handleKeywordsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace to remove last pill when input is empty
    if (e.key === 'Backspace' && keywordsInput === '' && formData.keywords.length > 0) {
      removeKeyword(formData.keywords.length - 1);
      return;
    }

    // Handle Enter to add current input as pill (even without comma)
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0 && filteredSuggestions.length > 0) {
        handleSuggestionClick(filteredSuggestions[selectedSuggestionIndex]);
      } else if (keywordsInput.trim()) {
        addKeyword(keywordsInput);
      }
      return;
    }

    if (!showSuggestions || filteredSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) =>
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  const handleKeywordsBlur = () => {
    // Add current input as pill on blur if there's text
    if (keywordsInput.trim()) {
      addKeyword(keywordsInput);
    }
    // Delay hiding to allow click on suggestion
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }, 150);
  };

  // Handle profile image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setIsUploadingImage(true);
    setError(null);

    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const response = await fetch(`${API_URL}/admin/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formDataUpload,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      if (data.url) {
        setFormData((prev) => ({
          ...prev,
          profileImageUrl: data.url,
        }));
        setSuccess('Image uploaded successfully!');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      setError('Failed to upload image');
    } finally {
      setIsUploadingImage(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Check if company has content
      const companyHasContent =
        formData.company?.en || formData.company?.es || formData.company?.pt;

      const submitData = {
        ...formData,
        company: companyHasContent ? formData.company : undefined,
      };

      const response = await fetch(`${API_URL}/admin/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save profile');
      }

      setSuccess('Profile saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isTabComplete = (lang: keyof LocalizedString) => {
    return (
      formData.name[lang]?.trim() !== '' &&
      formData.blurb[lang]?.trim() !== '' &&
      formData.role[lang]?.trim() !== ''
    );
  };

  const copyLocalizedContent = () => {
    if (copyFromLang === copyToLang) return;

    setFormData((prev) => ({
      ...prev,
      name: {
        ...prev.name,
        [copyToLang]: prev.name[copyFromLang],
      },
      blurb: {
        ...prev.blurb,
        [copyToLang]: prev.blurb[copyFromLang],
      },
      role: {
        ...prev.role,
        [copyToLang]: prev.role[copyFromLang],
      },
      company: prev.company
        ? {
            ...prev.company,
            [copyToLang]: prev.company[copyFromLang],
          }
        : prev.company,
    }));

    // Switch to the target tab to show the copied content
    setActiveTab(copyToLang);
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/admin" className={styles.backLink}>
            ← Back to Dashboard
          </Link>
          <h1 className={styles.title}>Edit Profile</h1>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Profile Image</h2>
          <p className={styles.sectionDescription}>
            Upload a profile photo that will be displayed on the About page.
          </p>

          <div className={styles.imageUploadArea}>
            <div className={styles.imagePreview}>
              {formData.profileImageUrl ? (
                <img
                  src={`${API_URL}${formData.profileImageUrl}`}
                  alt="Profile"
                  className={styles.previewImage}
                />
              ) : (
                <div className={styles.noImage}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
              )}
            </div>
            <div className={styles.imageUploadControls}>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className={styles.fileInput}
                id="profile-image-upload"
                disabled={isUploadingImage}
              />
              <label htmlFor="profile-image-upload" className={styles.uploadButton}>
                {isUploadingImage ? 'Uploading...' : formData.profileImageUrl ? 'Change Image' : 'Upload Image'}
              </label>
              {formData.profileImageUrl && (
                <button
                  type="button"
                  className={styles.removeImageButton}
                  onClick={() => setFormData((prev) => ({ ...prev, profileImageUrl: '' }))}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Localized Content</h2>
          <p className={styles.sectionDescription}>
            Fill in the content for each language. Switch between tabs to enter translations.
          </p>

          <div className={styles.tabs}>
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                className={`${styles.tab} ${activeTab === lang ? styles.activeTab : ''} ${isTabComplete(lang) ? styles.completeTab : ''}`}
                onClick={() => setActiveTab(lang)}
              >
                {LANGUAGE_LABELS[lang]}
                {isTabComplete(lang) && <span className={styles.checkmark}>✓</span>}
              </button>
            ))}
          </div>

          <div className={styles.tabContent}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                Name <span className={styles.langBadge}>{activeTab.toUpperCase()}</span>
              </label>
              <input
                type="text"
                value={formData.name[activeTab]}
                onChange={(e) => handleLocalizedChange('name', activeTab, e.target.value)}
                className={styles.input}
                placeholder="Your full name"
                required={activeTab === 'en'}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                Role / Title <span className={styles.langBadge}>{activeTab.toUpperCase()}</span>
              </label>
              <input
                type="text"
                value={formData.role[activeTab]}
                onChange={(e) => handleLocalizedChange('role', activeTab, e.target.value)}
                className={styles.input}
                placeholder="e.g., Senior Software Engineer"
                required={activeTab === 'en'}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                Blurb / Bio <span className={styles.langBadge}>{activeTab.toUpperCase()}</span>
              </label>
              <div className={styles.markdownEditor} data-color-mode="light">
                <MDEditor
                  value={formData.blurb[activeTab]}
                  onChange={(value: string | undefined) => handleLocalizedChange('blurb', activeTab, value || '')}
                  preview="live"
                  height={200}
                  textareaProps={{
                    placeholder: 'Write your bio in markdown...',
                  }}
                />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                Company <span className={styles.langBadge}>{activeTab.toUpperCase()}</span>
                <span className={styles.optional}>(optional)</span>
              </label>
              <input
                type="text"
                value={formData.company?.[activeTab] || ''}
                onChange={(e) => handleLocalizedChange('company', activeTab, e.target.value)}
                className={styles.input}
                placeholder="Current company"
              />
            </div>
          </div>

          <div className={styles.translationStatus}>
            {LANGUAGES.map((lang) => (
              <div
                key={lang}
                className={`${styles.statusItem} ${isTabComplete(lang) ? styles.complete : styles.incomplete}`}
              >
                <span className={styles.statusLang}>{lang.toUpperCase()}</span>
                <span className={styles.statusText}>
                  {isTabComplete(lang) ? 'Complete' : 'Incomplete'}
                </span>
              </div>
            ))}
          </div>

          <div className={styles.copyWidget}>
            <span className={styles.copyLabel}>Copy from</span>
            <select
              value={copyFromLang}
              onChange={(e) => setCopyFromLang(e.target.value as 'en' | 'es' | 'pt')}
              className={styles.copySelect}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {LANGUAGE_LABELS[lang]}
                </option>
              ))}
            </select>
            <span className={styles.copyLabel}>to</span>
            <select
              value={copyToLang}
              onChange={(e) => setCopyToLang(e.target.value as 'en' | 'es' | 'pt')}
              className={styles.copySelect}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {LANGUAGE_LABELS[lang]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={copyLocalizedContent}
              className={styles.copyButton}
              disabled={copyFromLang === copyToLang}
            >
              Copy
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Skills & Keywords</h2>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Keywords</label>
            <div className={styles.autocompleteContainer}>
              <div className={styles.pillsInputContainer}>
                {formData.keywords.map((keyword, index) => (
                  <span key={index} className={styles.pill}>
                    {keyword}
                    <button
                      type="button"
                      className={styles.pillRemove}
                      onClick={() => removeKeyword(index)}
                      aria-label={`Remove ${keyword}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={keywordsInput}
                  onChange={(e) => handleKeywordsInputChange(e.target.value)}
                  onKeyDown={handleKeywordsKeyDown}
                  onBlur={handleKeywordsBlur}
                  onFocus={() => {
                    if (keywordsInput.trim().length > 0) {
                      handleKeywordsInputChange(keywordsInput);
                    }
                  }}
                  className={styles.pillInput}
                  placeholder={formData.keywords.length === 0 ? "Type and press comma or Enter to add..." : ""}
                />
              </div>
              {showSuggestions && filteredSuggestions.length > 0 && (
                <ul className={styles.suggestionsList}>
                  {filteredSuggestions.slice(0, 10).map((suggestion, index) => (
                    <li
                      key={suggestion}
                      className={`${styles.suggestionItem} ${index === selectedSuggestionIndex ? styles.selected : ''}`}
                      onMouseDown={() => handleSuggestionClick(suggestion)}
                      onMouseEnter={() => setSelectedSuggestionIndex(index)}
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className={styles.hint}>Type and press comma or Enter to add. Backspace removes the last keyword.</p>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Social Links</h2>

          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>LinkedIn URL</label>
              <input
                type="url"
                value={formData.linkedinUrl}
                onChange={(e) => handleChange('linkedinUrl', e.target.value)}
                className={styles.input}
                placeholder="https://linkedin.com/in/yourprofile"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>GitHub URL</label>
              <input
                type="url"
                value={formData.githubUrl}
                onChange={(e) => handleChange('githubUrl', e.target.value)}
                className={styles.input}
                placeholder="https://github.com/yourusername"
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Website URL</label>
            <input
              type="url"
              value={formData.websiteUrl}
              onChange={(e) => handleChange('websiteUrl', e.target.value)}
              className={styles.input}
              placeholder="https://yourwebsite.com"
            />
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Contact Information</h2>

          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={styles.input}
                placeholder="your@email.com"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className={styles.input}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              className={styles.input}
              placeholder="123 Main St"
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                className={styles.input}
                placeholder="San Francisco"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>State</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => handleChange('state', e.target.value)}
                className={styles.input}
                placeholder="CA"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>ZIP Code</label>
              <input
                type="text"
                value={formData.zip}
                onChange={(e) => handleChange('zip', e.target.value)}
                className={styles.input}
                placeholder="94102"
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Country</label>
            <input
              type="text"
              value={formData.country}
              onChange={(e) => handleChange('country', e.target.value)}
              className={styles.input}
              placeholder="United States"
            />
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting || !LANGUAGES.every(isTabComplete)}
          >
            {isSubmitting ? 'Saving...' : 'Save Profile'}
          </button>
          {!LANGUAGES.every(isTabComplete) && (
            <p className={styles.warning}>
              Please complete all required fields in all languages before saving.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}

