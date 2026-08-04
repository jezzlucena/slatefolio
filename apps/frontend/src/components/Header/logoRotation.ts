/**
 * Shared between the server layout (reads the cookie) and the client Header
 * (writes it). Must stay free of 'use client' so the server gets real values,
 * not client-reference proxies.
 */
export const LOGO_COOKIE = 'logo-index';
export const LOGO_COUNT = 4;
