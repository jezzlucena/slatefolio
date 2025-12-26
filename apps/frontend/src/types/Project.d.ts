import type { LocalizedString } from "./LocalizedString";

export type Project = {
  name: LocalizedString;
  description: LocalizedString;
  company: LocalizedString;
  role: LocalizedString;
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
}
