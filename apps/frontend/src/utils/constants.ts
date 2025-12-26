import type { Language } from '../types/Language'

/**
 * Hardcoded localized names of the available languages
 * in each respective tongue, plus a flag emoji.
 */
export const LANGUAGES: {
  [key in Language]: {
    long: string
    short: string
  }
} = {
  "en": {
    long: 'English 🇺🇸',
    short: 'Eng. 🇺🇸',
  },
  "es": {
    long: 'Español 🇪🇸',
    short: 'Esp. 🇪🇸',
  },
  "pt": {
    long: 'Português 🇧🇷',
    short: 'Por. 🇧🇷',
  }
}

export const PROFILE_KEYWORDS = [
  "JavaScript",
  "TypeScript",
  "React",
  "NextJS",
  "Nuxt",
  "Vue 3",
  "Python",
  "Django",
  "ES6",
  "HTML5",
  "CSS3",
  "Ruby on Rails",
  "Agile Development",
  "UX/UI Design",
  "RESTful APIs",
  "i18n"
]