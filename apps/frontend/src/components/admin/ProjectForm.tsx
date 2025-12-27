'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import styles from './ProjectForm.module.scss';

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

interface LocalizedString {
  en: string;
  es: string;
  pt: string;
}

interface ProjectData {
  key: string;
  name: LocalizedString;
  description: LocalizedString;
  company: LocalizedString;
  role: LocalizedString;
  year: number;
  platforms: string[];
  stack: string[];
  thumbImgUrl: string;
  thumbAspectRatio?: number;
  thumbVideoUrl?: string;
  thumbGifUrl?: string;
  behanceUrl?: string;
  videoUrl?: string;
  githubUrl?: string;
  liveDemoUrl?: string;
}

interface ProjectFormProps {
  initialData?: Partial<ProjectData>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isSubmitting: boolean;
  isEditMode?: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

const emptyLocalizedString = (): LocalizedString => ({
  en: '',
  es: '',
  pt: '',
});

const LANGUAGES = ['en', 'es', 'pt'] as const;
const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Español',
  pt: 'Português',
};

// Predefined aspect ratios (height / width)
const ASPECT_RATIOS = [
  { label: '16:9 (Widescreen)', value: 9 / 16 },
  { label: '4:3 (Standard)', value: 3 / 4 },
  { label: '1:1 (Square)', value: 1 },
  { label: '3:2 (Photo)', value: 2 / 3 },
  { label: '21:9 (Ultrawide)', value: 9 / 21 },
  { label: '9:16 (Vertical)', value: 16 / 9 },
  { label: '3:4 (Portrait)', value: 4 / 3 },
  { label: '2:3 (Portrait Photo)', value: 3 / 2 },
] as const;

export default function ProjectForm({
  initialData,
  onSubmit,
  isSubmitting,
  isEditMode = false,
}: ProjectFormProps) {
  const [formData, setFormData] = useState<ProjectData>({
    key: initialData?.key || '',
    name: initialData?.name || emptyLocalizedString(),
    description: initialData?.description || emptyLocalizedString(),
    company: initialData?.company || emptyLocalizedString(),
    role: initialData?.role || emptyLocalizedString(),
    year: initialData?.year || new Date().getFullYear(),
    platforms: initialData?.platforms || [],
    stack: initialData?.stack || [],
    thumbImgUrl: initialData?.thumbImgUrl || '',
    thumbAspectRatio: initialData?.thumbAspectRatio,
    thumbVideoUrl: initialData?.thumbVideoUrl || '',
    thumbGifUrl: initialData?.thumbGifUrl || '',
    behanceUrl: initialData?.behanceUrl || '',
    videoUrl: initialData?.videoUrl || '',
    githubUrl: initialData?.githubUrl || '',
    liveDemoUrl: initialData?.liveDemoUrl || '',
  });

  const [platformsInput, setPlatformsInput] = useState('');
  const [stackInput, setStackInput] = useState('');
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Shared autocomplete state (both platforms and stack use the same suggestions)
  const [filteredPlatformsSuggestions, setFilteredPlatformsSuggestions] = useState<string[]>([]);
  const [showPlatformsSuggestions, setShowPlatformsSuggestions] = useState(false);
  const [selectedPlatformsIndex, setSelectedPlatformsIndex] = useState(-1);

  const [filteredStackSuggestions, setFilteredStackSuggestions] = useState<string[]>([]);
  const [showStackSuggestions, setShowStackSuggestions] = useState(false);
  const [selectedStackIndex, setSelectedStackIndex] = useState(-1);

  // Tab state for localized content
  const [activeTab, setActiveTab] = useState<'en' | 'es' | 'pt'>('en');
  const [copyFromLang, setCopyFromLang] = useState<'en' | 'es' | 'pt'>('en');
  const [copyToLang, setCopyToLang] = useState<'en' | 'es' | 'pt'>('es');

  // Aspect ratio state
  const [isCustomAspectRatio, setIsCustomAspectRatio] = useState(() => {
    // Check if initial value matches a predefined ratio
    if (!initialData?.thumbAspectRatio) return false;
    return !ASPECT_RATIOS.some(
      (ar) => Math.abs(ar.value - initialData.thumbAspectRatio!) < 0.001
    );
  });

  // Preview state
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const locale = useLocale() as keyof LocalizedString;

  const thumbImgRef = useRef<HTMLInputElement>(null);
  const thumbVideoRef = useRef<HTMLInputElement>(null);
  const thumbGifRef = useRef<HTMLInputElement>(null);

  // Debounced fetch for autocomplete suggestions
  const fetchAutocompleteSuggestions = useCallback(
    async (query: string, field: 'platforms' | 'stack') => {
      try {
        const response = await fetch(
          `${API_URL}/autocomplete/suggestions?q=${encodeURIComponent(query)}`
        );
        if (response.ok) {
          const data = await response.json();
          const suggestions = data.suggestions || [];
          
          // Filter out already selected items
          const existingItems = field === 'platforms' ? formData.platforms : formData.stack;
          const filtered = suggestions.filter(
            (s: string) => !existingItems.some((item) => item.toLowerCase() === s.toLowerCase())
          );
          
          if (field === 'platforms') {
            setFilteredPlatformsSuggestions(filtered);
            setShowPlatformsSuggestions(filtered.length > 0 && query.trim().length > 0);
          } else {
            setFilteredStackSuggestions(filtered);
            setShowStackSuggestions(filtered.length > 0 && query.trim().length > 0);
          }
        }
      } catch (error) {
        console.error('Error fetching autocomplete suggestions:', error);
      }
    },
    [formData.platforms, formData.stack]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedFetchSuggestions = useCallback(
    debounce((query: string, field: 'platforms' | 'stack') => {
      fetchAutocompleteSuggestions(query, field);
    }, 300),
    [fetchAutocompleteSuggestions]
  );

  // Platform pill management
  const addPlatform = (platform: string) => {
    const trimmed = platform.trim();
    if (trimmed && !formData.platforms.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      setFormData((prev) => ({
        ...prev,
        platforms: [...prev.platforms, trimmed],
      }));
    }
    setPlatformsInput('');
    setShowPlatformsSuggestions(false);
    setFilteredPlatformsSuggestions([]);
    setSelectedPlatformsIndex(-1);
  };

  const removePlatform = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      platforms: prev.platforms.filter((_, i) => i !== index),
    }));
  };

  const handlePlatformsInputChange = (value: string) => {
    if (value.includes(',')) {
      const parts = value.split(',');
      parts.slice(0, -1).forEach((part) => {
        const trimmed = part.trim();
        if (trimmed) addPlatform(trimmed);
      });
      setPlatformsInput(parts[parts.length - 1]);
      return;
    }

    setPlatformsInput(value);
    const currentWord = value.trim();
    
    if (currentWord.length > 0) {
      debouncedFetchSuggestions(currentWord, 'platforms');
      setSelectedPlatformsIndex(-1);
    } else {
      setShowPlatformsSuggestions(false);
      setFilteredPlatformsSuggestions([]);
    }
  };

  const handlePlatformsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && platformsInput === '' && formData.platforms.length > 0) {
      removePlatform(formData.platforms.length - 1);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedPlatformsIndex >= 0 && filteredPlatformsSuggestions.length > 0) {
        addPlatform(filteredPlatformsSuggestions[selectedPlatformsIndex]);
      } else if (platformsInput.trim()) {
        addPlatform(platformsInput);
      }
      return;
    }

    if (!showPlatformsSuggestions || filteredPlatformsSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedPlatformsIndex((prev) =>
        prev < filteredPlatformsSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedPlatformsIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setShowPlatformsSuggestions(false);
      setSelectedPlatformsIndex(-1);
    }
  };

  const handlePlatformsBlur = () => {
    if (platformsInput.trim()) {
      addPlatform(platformsInput);
    }
    setTimeout(() => {
      setShowPlatformsSuggestions(false);
      setSelectedPlatformsIndex(-1);
    }, 150);
  };

  // Stack pill management
  const addStack = (stack: string) => {
    const trimmed = stack.trim();
    if (trimmed && !formData.stack.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setFormData((prev) => ({
        ...prev,
        stack: [...prev.stack, trimmed],
      }));
    }
    setStackInput('');
    setShowStackSuggestions(false);
    setFilteredStackSuggestions([]);
    setSelectedStackIndex(-1);
  };

  const removeStack = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      stack: prev.stack.filter((_, i) => i !== index),
    }));
  };

  const handleStackInputChange = (value: string) => {
    if (value.includes(',')) {
      const parts = value.split(',');
      parts.slice(0, -1).forEach((part) => {
        const trimmed = part.trim();
        if (trimmed) addStack(trimmed);
      });
      setStackInput(parts[parts.length - 1]);
      return;
    }

    setStackInput(value);
    const currentWord = value.trim();
    
    if (currentWord.length > 0) {
      debouncedFetchSuggestions(currentWord, 'stack');
      setSelectedStackIndex(-1);
    } else {
      setShowStackSuggestions(false);
      setFilteredStackSuggestions([]);
    }
  };

  const handleStackKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && stackInput === '' && formData.stack.length > 0) {
      removeStack(formData.stack.length - 1);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedStackIndex >= 0 && filteredStackSuggestions.length > 0) {
        addStack(filteredStackSuggestions[selectedStackIndex]);
      } else if (stackInput.trim()) {
        addStack(stackInput);
      }
      return;
    }

    if (!showStackSuggestions || filteredStackSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedStackIndex((prev) =>
        prev < filteredStackSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedStackIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setShowStackSuggestions(false);
      setSelectedStackIndex(-1);
    }
  };

  const handleStackBlur = () => {
    if (stackInput.trim()) {
      addStack(stackInput);
    }
    setTimeout(() => {
      setShowStackSuggestions(false);
      setSelectedStackIndex(-1);
    }, 150);
  };

  const handleLocalizedChange = (
    field: keyof Pick<ProjectData, 'name' | 'description' | 'company' | 'role'>,
    lang: keyof LocalizedString,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [lang]: value,
      },
    }));
  };

  const handleChange = (
    field: keyof ProjectData,
    value: string | number | string[]
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFileUpload = async (
    file: File,
    field: 'thumbImgUrl' | 'thumbVideoUrl' | 'thumbGifUrl'
  ) => {
    setUploadingField(field);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/admin/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();

      setFormData((prev) => {
        const updates: Partial<ProjectData> = {
          [field]: data.url,
        };

        // Set aspect ratio for images
        if (field === 'thumbImgUrl' && data.aspectRatio) {
          updates.thumbAspectRatio = parseFloat(data.aspectRatio);
        }

        return { ...prev, ...updates };
      });
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(`Failed to upload ${field}`);
    } finally {
      setUploadingField(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData as unknown as Record<string, unknown>);
  };

  const isTabComplete = (lang: keyof LocalizedString) => {
    return (
      formData.name[lang]?.trim() !== '' &&
      formData.description[lang]?.trim() !== '' &&
      formData.company[lang]?.trim() !== '' &&
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
      description: {
        ...prev.description,
        [copyToLang]: prev.description[copyFromLang],
      },
      company: {
        ...prev.company,
        [copyToLang]: prev.company[copyFromLang],
      },
      role: {
        ...prev.role,
        [copyToLang]: prev.role[copyFromLang],
      },
    }));

    // Switch to the target tab to show the copied content
    setActiveTab(copyToLang);
  };

  const renderFileUpload = (
    field: 'thumbImgUrl' | 'thumbVideoUrl' | 'thumbGifUrl',
    label: string,
    accept: string,
    ref: React.RefObject<HTMLInputElement | null>
  ) => (
    <div className={styles.fieldGroup}>
      <label className={styles.label}>{label}</label>
      <div className={styles.fileUpload}>
        {formData[field] && (
          <div className={styles.preview}>
            {field === 'thumbVideoUrl' ? (
              <video src={formData[field]} controls muted />
            ) : (
              <img src={formData[field]} alt="Preview" />
            )}
          </div>
        )}
        <div className={styles.uploadControls}>
          <input
            ref={ref}
            type="file"
            accept={accept}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file, field);
            }}
            className={styles.fileInput}
          />
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className={styles.uploadButton}
            disabled={uploadingField === field}
          >
            {uploadingField === field ? 'Uploading...' : 'Choose File'}
          </button>
          {formData[field] && (
            <button
              type="button"
              onClick={() => handleChange(field, '')}
              className={styles.clearButton}
            >
              Clear
            </button>
          )}
        </div>
        <input
          type="text"
          value={formData[field] || ''}
          onChange={(e) => handleChange(field, e.target.value)}
          placeholder="Or enter URL directly"
          className={styles.input}
        />
      </div>
    </div>
  );

  return (
    <>
    <form onSubmit={handleSubmit} className={styles.form}>
      {uploadError && <div className={styles.error}>{uploadError}</div>}

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Basic Information</h2>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Project Key (URL slug)</label>
          <input
            type="text"
            value={formData.key}
            onChange={(e) =>
              handleChange(
                'key',
                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
              )
            }
            className={styles.input}
            placeholder="e.g., my-awesome-project"
            disabled={isEditMode}
            required
          />
          {isEditMode && (
            <p className={styles.hint}>Project key cannot be changed</p>
          )}
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Year</label>
          <input
            type="number"
            value={formData.year}
            onChange={(e) => handleChange('year', parseInt(e.target.value))}
            className={styles.input}
            min={1990}
            max={2100}
            required
          />
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
              Project Name <span className={styles.langBadge}>{activeTab.toUpperCase()}</span>
            </label>
            <input
              type="text"
              value={formData.name[activeTab]}
              onChange={(e) => handleLocalizedChange('name', activeTab, e.target.value)}
              className={styles.input}
              placeholder="Project name"
              required={activeTab === 'en'}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              Description <span className={styles.langBadge}>{activeTab.toUpperCase()}</span>
            </label>
            <textarea
              value={formData.description[activeTab]}
              onChange={(e) => handleLocalizedChange('description', activeTab, e.target.value)}
              className={styles.textarea}
              placeholder="Project description"
              rows={4}
              required={activeTab === 'en'}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              Company <span className={styles.langBadge}>{activeTab.toUpperCase()}</span>
            </label>
            <input
              type="text"
              value={formData.company[activeTab]}
              onChange={(e) => handleLocalizedChange('company', activeTab, e.target.value)}
              className={styles.input}
              placeholder="Company name"
              required={activeTab === 'en'}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              Role <span className={styles.langBadge}>{activeTab.toUpperCase()}</span>
            </label>
            <input
              type="text"
              value={formData.role[activeTab]}
              onChange={(e) => handleLocalizedChange('role', activeTab, e.target.value)}
              className={styles.input}
              placeholder="Your role in the project"
              required={activeTab === 'en'}
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
        <h2 className={styles.sectionTitle}>Media</h2>

        {renderFileUpload(
          'thumbImgUrl',
          'Thumbnail Image *',
          'image/*',
          thumbImgRef
        )}

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Thumbnail Aspect Ratio</label>
          <div className={styles.aspectRatioContainer}>
            <select
              value={isCustomAspectRatio ? 'custom' : (formData.thumbAspectRatio?.toString() || '')}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setIsCustomAspectRatio(true);
                } else if (e.target.value === '') {
                  setIsCustomAspectRatio(false);
                  handleChange('thumbAspectRatio', '');
                } else {
                  setIsCustomAspectRatio(false);
                  handleChange('thumbAspectRatio', parseFloat(e.target.value));
                }
              }}
              className={styles.aspectRatioSelect}
            >
              <option value="">Auto (from image)</option>
              {ASPECT_RATIOS.map((ar) => (
                <option key={ar.label} value={ar.value.toString()}>
                  {ar.label} ({ar.value.toFixed(2)})
                </option>
              ))}
              <option value="custom">Custom...</option>
            </select>
            {isCustomAspectRatio && (
              <div className={styles.customAspectRatio}>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="10"
                  value={formData.thumbAspectRatio || ''}
                  onChange={(e) => handleChange('thumbAspectRatio', parseFloat(e.target.value) || '')}
                  className={styles.aspectRatioInput}
                  placeholder="e.g., 0.56"
                />
                <span className={styles.aspectRatioHint}>height ÷ width</span>
              </div>
            )}
          </div>
          <p className={styles.hint}>
            {formData.thumbAspectRatio
              ? `Current: ${formData.thumbAspectRatio.toFixed(2)} (${formData.thumbAspectRatio > 1 ? 'portrait' : formData.thumbAspectRatio < 1 ? 'landscape' : 'square'})`
              : 'Will be calculated from uploaded image'}
          </p>
        </div>

        {renderFileUpload(
          'thumbVideoUrl',
          'Preview Video (optional)',
          'video/*',
          thumbVideoRef
        )}
        {renderFileUpload(
          'thumbGifUrl',
          'Preview GIF (optional)',
          'image/gif',
          thumbGifRef
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Technical Details</h2>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Platforms</label>
          <div className={styles.autocompleteContainer}>
            <div
              className={styles.pillsInputContainer}
              onClick={(e) => {
                const input = e.currentTarget.querySelector('input');
                input?.focus();
              }}
            >
              {formData.platforms.map((platform, index) => (
                <span key={index} className={styles.pill}>
                  {platform}
                  <button
                    type="button"
                    className={styles.pillRemove}
                    onClick={(e) => {
                      e.stopPropagation();
                      removePlatform(index);
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={platformsInput}
                onChange={(e) => handlePlatformsInputChange(e.target.value)}
                onKeyDown={handlePlatformsKeyDown}
                onBlur={handlePlatformsBlur}
                className={styles.pillInput}
                placeholder={formData.platforms.length === 0 ? 'Type and press Enter or comma...' : ''}
              />
            </div>
            {showPlatformsSuggestions && filteredPlatformsSuggestions.length > 0 && (
              <ul className={styles.suggestionsList}>
                {filteredPlatformsSuggestions.map((suggestion, index) => (
                  <li
                    key={suggestion}
                    className={`${styles.suggestionItem} ${index === selectedPlatformsIndex ? styles.selected : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addPlatform(suggestion);
                    }}
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className={styles.hint}>Press comma or Enter to add a platform</p>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Tech Stack</label>
          <div className={styles.autocompleteContainer}>
            <div
              className={styles.pillsInputContainer}
              onClick={(e) => {
                const input = e.currentTarget.querySelector('input');
                input?.focus();
              }}
            >
              {formData.stack.map((tech, index) => (
                <span key={index} className={styles.pill}>
                  {tech}
                  <button
                    type="button"
                    className={styles.pillRemove}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeStack(index);
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={stackInput}
                onChange={(e) => handleStackInputChange(e.target.value)}
                onKeyDown={handleStackKeyDown}
                onBlur={handleStackBlur}
                className={styles.pillInput}
                placeholder={formData.stack.length === 0 ? 'Type and press Enter or comma...' : ''}
              />
            </div>
            {showStackSuggestions && filteredStackSuggestions.length > 0 && (
              <ul className={styles.suggestionsList}>
                {filteredStackSuggestions.map((suggestion, index) => (
                  <li
                    key={suggestion}
                    className={`${styles.suggestionItem} ${index === selectedStackIndex ? styles.selected : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addStack(suggestion);
                    }}
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className={styles.hint}>Press comma or Enter to add a technology</p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>External Links (optional)</h2>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Live Demo URL</label>
          <input
            type="url"
            value={formData.liveDemoUrl}
            onChange={(e) => handleChange('liveDemoUrl', e.target.value)}
            className={styles.input}
            placeholder="https://..."
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>GitHub URL</label>
          <input
            type="url"
            value={formData.githubUrl}
            onChange={(e) => handleChange('githubUrl', e.target.value)}
            className={styles.input}
            placeholder="https://github.com/..."
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Behance URL</label>
          <input
            type="url"
            value={formData.behanceUrl}
            onChange={(e) => handleChange('behanceUrl', e.target.value)}
            className={styles.input}
            placeholder="https://behance.net/..."
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Video URL</label>
          <input
            type="url"
            value={formData.videoUrl}
            onChange={(e) => handleChange('videoUrl', e.target.value)}
            className={styles.input}
            placeholder="https://youtube.com/..."
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.submitButton}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? 'Saving...'
            : isEditMode
            ? 'Update Project'
            : 'Create Project'}
        </button>
      </div>

      </form>

      {/* Fixed Preview Button */}
      <div
        className={`${styles.previewButton} ${isPreviewExpanded ? styles.expanded : ''}`}
        onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
      >
        {!isPreviewExpanded && (
          <div className={styles.previewIcon}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>Preview</span>
          </div>
        )}
        {isPreviewExpanded && (
          <div className={styles.previewContent}>
            <div className={styles.previewHeader}>
              <span>Gallery Item Preview</span>
              <span className={styles.previewLang}>{locale.toUpperCase()}</span>
            </div>
            <div className={styles.galleryItemPreview}>
              <div className={styles.previewWrapper}>
                <div
                  className={`${styles.previewThumbContainer} ${!formData.thumbImgUrl ? styles.shimmer : ''}`}
                  style={{ paddingBottom: `${((formData.thumbAspectRatio || 0.56) * 100)}%` }}
                >
                  {formData.thumbImgUrl && (
                    <img
                      className={styles.previewThumb}
                      src={formData.thumbImgUrl.startsWith('/') ? `${formData.thumbImgUrl}` : formData.thumbImgUrl}
                      alt="Thumbnail Preview"
                    />
                  )}
                </div>
                <div className={styles.previewDetails}>
                  <div className={`${styles.previewName} ${!formData.name[locale] ? styles.shimmer : ''}`}>
                    {formData.name[locale] || 'Project Name'}
                  </div>
                  <div className={styles.previewSubtitle}>
                    <span className={`${styles.previewRole} ${!formData.role[locale] ? styles.shimmer : ''}`}>
                      {formData.role[locale] || 'Role'}
                    </span>
                    <span className={`${styles.previewCompanyYear} ${!formData.company[locale] ? styles.shimmer : ''}`}>
                      {formData.company[locale] || 'Company'} • {formData.year}
                    </span>
                  </div>
                  <div className={`${styles.previewDescription} ${!formData.description[locale] ? styles.shimmer : ''}`}>
                    {formData.description[locale] || 'Project description will appear here...'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

