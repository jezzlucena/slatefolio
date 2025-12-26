import type { LocalizedString } from "./LocalizedString";
import type { Testimonial } from "./Testimonial";

export type Profile = {
  name: LocalizedString;
  blurb: LocalizedString;
  role: LocalizedString;
  company?: LocalizedString;
  keywords: string[];
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
  testimonials: Testimonial[];
}