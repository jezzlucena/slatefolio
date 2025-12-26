import { Request, Response } from 'express';
import Profile from '../models/Profile';
import Project from '../models/Project';
import { AuthRequest } from '../middleware/auth';

// Get the profile (public) - singleton, returns the only profile or null
export const getProfile = async (_req: Request, res: Response): Promise<void> => {
  try {
    const profile = await Profile.findOne();

    if (!profile) {
      res.json({ profile: null, exists: false });
      return;
    }

    res.json({ profile, exists: true });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

// Create or update the profile (admin only) - upsert pattern for singleton
export const upsertProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profileData = req.body;

    // Validate required localized fields
    const requiredLocalizedFields = ['name', 'blurb', 'role'];
    for (const field of requiredLocalizedFields) {
      if (!profileData[field] || !profileData[field].en || !profileData[field].es || !profileData[field].pt) {
        res.status(400).json({ error: `${field} must have en, es, and pt translations` });
        return;
      }
    }

    // Check if company has content - if all empty, set to null
    if (profileData.company) {
      const hasCompanyContent = 
        profileData.company.en || 
        profileData.company.es || 
        profileData.company.pt;
      if (!hasCompanyContent) {
        profileData.company = null;
      }
    }

    // Parse keywords if it's a string
    if (typeof profileData.keywords === 'string') {
      profileData.keywords = profileData.keywords
        .split(',')
        .map((k: string) => k.trim())
        .filter((k: string) => k);
    }

    // Find existing profile or create new one (singleton pattern)
    let profile = await Profile.findOne();

    if (profile) {
      // Update existing profile
      Object.assign(profile, profileData);
      await profile.save();
    } else {
      // Create new profile
      profile = new Profile(profileData);
      await profile.save();
    }

    res.json({ profile, created: !profile.createdAt });
  } catch (error) {
    console.error('Error saving profile:', error);
    res.status(500).json({ error: 'Failed to save profile' });
  }
};

// Get keyword suggestions from profile keywords + project data
export const getKeywordSuggestions = async (_req: Request, res: Response): Promise<void> => {
  try {
    const suggestions = new Set<string>();

    // Get existing profile keywords
    const profile = await Profile.findOne();
    if (profile?.keywords) {
      profile.keywords.forEach((keyword) => suggestions.add(keyword));
    }

    // Get all projects
    const projects = await Project.find();

    for (const project of projects) {
      // Add company names (all languages)
      if (project.company) {
        if (project.company.en) suggestions.add(project.company.en);
        if (project.company.es) suggestions.add(project.company.es);
        if (project.company.pt) suggestions.add(project.company.pt);
      }

      // Add platforms
      if (project.platforms) {
        project.platforms.forEach((platform) => suggestions.add(platform));
      }

      // Add stack items
      if (project.stack) {
        project.stack.forEach((tech) => suggestions.add(tech));
      }
    }

    // Convert to sorted array
    const sortedSuggestions = Array.from(suggestions).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    res.json({ suggestions: sortedSuggestions });
  } catch (error) {
    console.error('Error fetching keyword suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch keyword suggestions' });
  }
};

export default {
  getProfile,
  upsertProfile,
  getKeywordSuggestions,
};

