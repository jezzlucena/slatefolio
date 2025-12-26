import type { LocalizedString } from "./LocalizedString";

export type Testimonial = {
  author: string;
  url: string;
  quote: LocalizedString;
  role?: LocalizedString;
  connection: LocalizedString;
}