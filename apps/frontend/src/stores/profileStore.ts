import { create } from 'zustand';
import type { LocalizedString } from '@/types/LocalizedString';

export interface ProfileData {
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
}

interface ProfileState {
  profile: ProfileData | null;
  isLoading: boolean;
  error: string | null;
  hasFetched: boolean;
  fetchProfile: () => Promise<void>;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  isLoading: false,
  error: null,
  hasFetched: false,

  fetchProfile: async () => {
    // If already fetched or currently fetching, don't fetch again
    if (get().hasFetched || get().isLoading) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_URL}/profile`);
      if (response.ok) {
        const data = await response.json();
        set({ 
          profile: data.profile || null, 
          isLoading: false,
          hasFetched: true 
        });
      } else {
        set({ 
          error: 'Failed to fetch profile', 
          isLoading: false,
          hasFetched: true 
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      set({ 
        error: 'Failed to fetch profile', 
        isLoading: false,
        hasFetched: true 
      });
    }
  },
}));

// Custom hook for easy usage with auto-fetch
export function useProfile() {
  const { profile, isLoading, error, fetchProfile, hasFetched } = useProfileStore();

  // Trigger fetch on first use (will only fetch once due to hasFetched check)
  if (!hasFetched && !isLoading) {
    fetchProfile();
  }

  return { profile, isLoading, error };
}

