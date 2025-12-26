import mongoose, { Document, Schema } from 'mongoose';

export interface ILocalizedString {
  en: string;
  es: string;
  pt: string;
}

export interface IProfile extends Document {
  name: ILocalizedString;
  blurb: ILocalizedString;
  role: ILocalizedString;
  company?: ILocalizedString;
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
  createdAt: Date;
  updatedAt: Date;
}

const LocalizedStringSchema = new Schema<ILocalizedString>(
  {
    en: { type: String, required: true },
    es: { type: String, required: true },
    pt: { type: String, required: true },
  },
  { _id: false }
);

const OptionalLocalizedStringSchema = new Schema<ILocalizedString>(
  {
    en: { type: String },
    es: { type: String },
    pt: { type: String },
  },
  { _id: false }
);

const ProfileSchema = new Schema<IProfile>(
  {
    name: {
      type: LocalizedStringSchema,
      required: true,
    },
    blurb: {
      type: LocalizedStringSchema,
      required: true,
    },
    role: {
      type: LocalizedStringSchema,
      required: true,
    },
    company: {
      type: OptionalLocalizedStringSchema,
      default: null,
    },
    keywords: {
      type: [String],
      default: [],
    },
    linkedinUrl: {
      type: String,
      default: null,
    },
    githubUrl: {
      type: String,
      default: null,
    },
    websiteUrl: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      default: null,
    },
    address: {
      type: String,
      default: null,
    },
    city: {
      type: String,
      default: null,
    },
    state: {
      type: String,
      default: null,
    },
    zip: {
      type: String,
      default: null,
    },
    country: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IProfile>('Profile', ProfileSchema);

