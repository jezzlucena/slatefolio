/**
 * Shared between the server layout (reads the cookie) and the client Header
 * (writes it). Must stay free of 'use client' so the server gets real values,
 * not client-reference proxies.
 */
export const LOGO_COOKIE = 'logo-index';

export interface LogoEntry {
  /** Theme slug: the `?logo=<slug>` deep link and the i18n key under
   * `logoSwitcher.taglines` in messages/*.json */
  slug: string;
  /** Display name shown in the LogoSwitcher coverflow (proper names — not
   * translated) */
  name: string;
  /** Public path of the coverflow thumbnail (landscape, ideally 16:9). `null`
   * renders the placeholder card until an image is added. */
  thumbnail: string | null;
}

/**
 * The logo family, in rotation order. Order MUST match LOGOS in Header.tsx.
 * Each entry doubles as the `?logo=<slug>` deep link: on any page it shows
 * that logo directly (e.g. /?logo=slyce), overriding the rotation cookie for
 * that visit.
 */
export const LOGO_CATALOG: LogoEntry[] = [
  { slug: 'mosaic', name: 'Mosaic', thumbnail: "/img/header/mosaic.png" }, // Logo — aurora tile mosaic
  { slug: 'drone', name: 'Drone', thumbnail: "/img/header/drone.png" }, // Logo2 — first-person drone flyover of a low-poly world
  { slug: 'slyce', name: 'Slyce', thumbnail: "/img/header/slyce.png" }, // Logo3 — 8-bit pong built around slice spin
  { slug: 'rose', name: 'Rose', thumbnail: "/img/header/rose.png" }, // Logo4 — rose window / impossible knot
  { slug: 'tetra', name: 'Tetra', thumbnail: "/img/header/tetra.png" }, // Logo5 — tetrahedron flood-fill field
  { slug: 'origami', name: 'Origami', thumbnail: "/img/header/origami.png" }, // Logo6 — isometric cube wall unfolding
  { slug: 'vasarely', name: 'Vasarely', thumbnail: "/img/header/vasarely.png" }, // Logo7 — checkerboard warped by a gaussian bulge
  { slug: 'copacabana', name: 'Copacabana', thumbnail: "/img/header/copacabana.png" }, // Logo8 — crescent columns in blend-mode difference
  { slug: 'glitch', name: 'Glitch', thumbnail: "/img/header/glitch.png" }, // Logo9 — torn-broadcast aurora test card
  { slug: 'interference', name: 'Interference', thumbnail: "/img/header/interference.png" }, // Logo10 — engraved ellipse plates forming optical folds
  { slug: 'flipdots', name: 'Flipdots', thumbnail: "/img/header/flipdots.png" }, // Flipdots — webcam silhouette on a mechanical flip-dot panel
];

/** One theme slug per logo, same order as LOGO_CATALOG (and LOGOS in Header.tsx) */
export const LOGO_THEMES = LOGO_CATALOG.map(logo => logo.slug);
