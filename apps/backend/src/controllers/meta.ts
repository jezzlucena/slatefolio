import { Request, Response } from 'express';
import Profile from '../models/Profile';
import Project from '../models/Project';
import Testimonial from '../models/Testimonial';
import Resume from '../models/Resume';

/**
 * Get site metadata including the last updated date
 * (most recent updatedAt across Profile, Projects, Testimonials, and active Resume)
 */
export const getSiteMeta = async (_req: Request, res: Response): Promise<void> => {
  try {
    const dates: Date[] = [];

    // Get profile last updated
    const profile = await Profile.findOne().select('updatedAt').lean();
    if (profile?.updatedAt) {
      dates.push(new Date(profile.updatedAt));
    }

    // Get most recent project update
    const latestProject = await Project.findOne()
      .sort({ updatedAt: -1 })
      .select('updatedAt')
      .lean();
    if (latestProject?.updatedAt) {
      dates.push(new Date(latestProject.updatedAt));
    }

    // Get most recent testimonial update
    const latestTestimonial = await Testimonial.findOne()
      .sort({ updatedAt: -1 })
      .select('updatedAt')
      .lean();
    if (latestTestimonial?.updatedAt) {
      dates.push(new Date(latestTestimonial.updatedAt));
    }

    // Get active resume last updated
    const activeResume = await Resume.findOne({ isActive: true })
      .select('updatedAt')
      .lean();
    if (activeResume?.updatedAt) {
      dates.push(new Date(activeResume.updatedAt));
    }

    // Find the most recent date
    let lastUpdated: string | null = null;
    if (dates.length > 0) {
      const mostRecent = new Date(Math.max(...dates.map(d => d.getTime())));
      lastUpdated = mostRecent.toISOString();
    }

    res.json({ lastUpdated });
  } catch (error) {
    console.error('Error fetching site meta:', error);
    res.status(500).json({ error: 'Failed to fetch site metadata' });
  }
};

export default {
  getSiteMeta,
};

