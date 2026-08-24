'use client'

import { useEffect, useState } from "react";

/**
 * The site's resolved theme ('light' | 'dark'), tracking both an explicit
 * ThemeSwitcher choice (html[data-theme]) and, in auto mode, the OS
 * preference. For consumers that can't use the CSS tokens directly — e.g.
 * third-party widgets keyed off a data-color-mode prop.
 */
export default function useResolvedTheme(): 'light' | 'dark' {
  // SSR renders 'light'; corrected on mount before first paint of interest
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const resolve = () => {
      const explicit = document.documentElement.dataset.theme;
      setTheme(explicit === 'dark' || (!explicit && media.matches) ? 'dark' : 'light');
    };
    resolve();
    media.addEventListener('change', resolve);
    const observer = new MutationObserver(resolve);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => {
      media.removeEventListener('change', resolve);
      observer.disconnect();
    };
  }, []);

  return theme;
}
