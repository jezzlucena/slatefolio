/**
 * Shared between the server layout (reads the cookie) and the client Header
 * (writes it). Must stay free of 'use client' so the server gets real values,
 * not client-reference proxies.
 */
export const LOGO_COOKIE = 'logo-index';

/**
 * One theme slug per logo, for deep links: `?logo=<theme>` on any page shows
 * that logo directly (e.g. /?logo=slyce), overriding the rotation cookie for
 * that visit. Order MUST match LOGOS in Header.tsx.
 */
export const LOGO_THEMES = [
  'mosaic', // Logo — aurora tile mosaic
  'drone', // Logo2 — first-person drone flyover of a low-poly world
  'slyce', // Logo3 — 8-bit pong built around slice spin
  'rose', // Logo4 — rose window / impossible knot
  'tetra', // Logo5 — tetrahedron flood-fill field
  'origami', // Logo6 — isometric cube wall unfolding
  'vasarely', // Logo7 — checkerboard warped by a gaussian bulge
  'copacabana', // Logo8 — crescent columns in blend-mode difference
  'glitch', // Logo9 — torn-broadcast aurora test card
];
