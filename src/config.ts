/**
 * API base URL for production (Vercel + Railway split).
 * Empty = same origin (dev with Express).
 */
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
