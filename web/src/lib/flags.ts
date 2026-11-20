/**
 * Build-time feature switches. A feature is on unless its build sets VITE_FLAG_<NAME>=off; `.env.hosted` does that
 * for the public site. A feature that is off has no navigation entry and its route redirects home.
 */
export const flags = {
  wrapped: import.meta.env.VITE_FLAG_WRAPPED !== 'off',
} as const
