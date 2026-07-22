/**
 * Resolve a path under /public, honouring the deploy base path.
 *
 * Next's `basePath` rewrites its OWN URLs — framework chunks, next/link,
 * next/image — but it does not touch strings you pass to fetch, to a loader, or
 * to useGLTF. On GitHub Pages the site lives at /wipely/, so a hardcoded
 * '/models/hand.glb' resolves to the domain root and 404s. Every runtime asset
 * URL goes through here instead.
 *
 * NEXT_PUBLIC_BASE_PATH is set by the Pages workflow and is empty everywhere
 * else, so local development and the dev server are unaffected.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export function asset(path: string): string {
  if (!path.startsWith('/')) return path
  return `${BASE_PATH}${path}`
}
