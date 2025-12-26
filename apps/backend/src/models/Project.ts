import mongoose, { Document, Schema } from 'mongoose';

export interface ILocalizedString {
  en: string;
  es: string;
  pt: string;
}

export interface IProject extends Document {
  key: string;
  name: ILocalizedString;
  description: ILocalizedString;
  company: ILocalizedString;
  role: ILocalizedString;
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

const ProjectSchema = new Schema<IProject>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: LocalizedStringSchema,
      required: true,
    },
    description: {
      type: LocalizedStringSchema,
      required: true,
    },
    company: {
      type: LocalizedStringSchema,
      required: true,
    },
    role: {
      type: LocalizedStringSchema,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    platforms: {
      type: [String],
      required: true,
    },
    stack: {
      type: [String],
      required: true,
    },
    thumbImgUrl: {
      type: String,
      required: true,
    },
    thumbAspectRatio: {
      type: Number,
      default: null,
    },
    thumbVideoUrl: {
      type: String,
      default: null,
    },
    thumbGifUrl: {
      type: String,
      default: null,
    },
    behanceUrl: {
      type: String,
      default: null,
    },
    videoUrl: {
      type: String,
      default: null,
    },
    githubUrl: {
      type: String,
      default: null,
    },
    liveDemoUrl: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IProject>('Project', ProjectSchema);

