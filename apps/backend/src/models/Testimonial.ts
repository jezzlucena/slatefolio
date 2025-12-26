import mongoose, { Document, Schema } from 'mongoose';

export interface ILocalizedString {
  en: string;
  es: string;
  pt: string;
}

export interface ITestimonial extends Document {
  key: string;
  author: string;
  url: string;
  quote: ILocalizedString;
  role?: ILocalizedString;
  connection: ILocalizedString;
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

const TestimonialSchema = new Schema<ITestimonial>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    author: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    quote: {
      type: LocalizedStringSchema,
      required: true,
    },
    role: {
      type: OptionalLocalizedStringSchema,
      default: null,
    },
    connection: {
      type: LocalizedStringSchema,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ITestimonial>('Testimonial', TestimonialSchema);

