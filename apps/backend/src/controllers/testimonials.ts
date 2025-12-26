import { Request, Response } from 'express';
import Testimonial from '../models/Testimonial';
import { AuthRequest } from '../middleware/auth';

// Get all testimonials (public)
export const getAllTestimonials = async (_req: Request, res: Response): Promise<void> => {
  try {
    const testimonials = await Testimonial.find().sort({ createdAt: -1 });
    res.json({ testimonials });
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    res.status(500).json({ error: 'Failed to fetch testimonials' });
  }
};

// Get single testimonial by key (public)
export const getTestimonialByKey = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const testimonial = await Testimonial.findOne({ key });

    if (!testimonial) {
      res.status(404).json({ error: 'Testimonial not found' });
      return;
    }

    res.json({ testimonial });
  } catch (error) {
    console.error('Error fetching testimonial:', error);
    res.status(500).json({ error: 'Failed to fetch testimonial' });
  }
};

// Create a new testimonial (admin only)
export const createTestimonial = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const testimonialData = req.body;

    // Validate required fields
    if (!testimonialData.key) {
      res.status(400).json({ error: 'Testimonial key is required' });
      return;
    }

    // Check if key already exists
    const existingTestimonial = await Testimonial.findOne({ key: testimonialData.key });
    if (existingTestimonial) {
      res.status(400).json({ error: 'Testimonial with this key already exists' });
      return;
    }

    // Validate required fields
    if (!testimonialData.author || !testimonialData.url) {
      res.status(400).json({ error: 'Author and URL are required' });
      return;
    }

    // Validate localized strings
    const requiredLocalizedFields = ['quote', 'connection'];
    for (const field of requiredLocalizedFields) {
      if (!testimonialData[field] || !testimonialData[field].en || !testimonialData[field].es || !testimonialData[field].pt) {
        res.status(400).json({ error: `${field} must have en, es, and pt translations` });
        return;
      }
    }

    const testimonial = new Testimonial(testimonialData);
    await testimonial.save();

    res.status(201).json({ testimonial });
  } catch (error) {
    console.error('Error creating testimonial:', error);
    res.status(500).json({ error: 'Failed to create testimonial' });
  }
};

// Update an existing testimonial (admin only)
export const updateTestimonial = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const updateData = req.body;

    // Don't allow changing the key via update
    if (updateData.key && updateData.key !== key) {
      res.status(400).json({ error: 'Cannot change testimonial key' });
      return;
    }

    const testimonial = await Testimonial.findOneAndUpdate(
      { key },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!testimonial) {
      res.status(404).json({ error: 'Testimonial not found' });
      return;
    }

    res.json({ testimonial });
  } catch (error) {
    console.error('Error updating testimonial:', error);
    res.status(500).json({ error: 'Failed to update testimonial' });
  }
};

// Delete a testimonial (admin only)
export const deleteTestimonial = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { key } = req.params;

    const testimonial = await Testimonial.findOneAndDelete({ key });

    if (!testimonial) {
      res.status(404).json({ error: 'Testimonial not found' });
      return;
    }

    res.json({ success: true, message: 'Testimonial deleted successfully' });
  } catch (error) {
    console.error('Error deleting testimonial:', error);
    res.status(500).json({ error: 'Failed to delete testimonial' });
  }
};

export default {
  getAllTestimonials,
  getTestimonialByKey,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
};

