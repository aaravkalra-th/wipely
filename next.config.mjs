/**
 * GitHub Pages notes.
 *
 * Pages serves static files — it never runs `next build`. So the site has to be
 * exported to plain HTML/JS/CSS and that output published, which is what
 * `output: 'export'` and the workflow in .github/workflows/pages.yml do.
 *
 * The project is served from https://<user>.github.io/wipely/, not from a
 * domain root, so every asset URL needs the `/wipely` prefix. That prefix must
 * NOT be applied during local development or `npm run dev` breaks, hence the
 * env flag rather than a hardcoded value.
 */

const isPages = process.env.GITHUB_PAGES === 'true'
const repo = '/wipely'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Static HTML export. Everything here is client-rendered already — the WebGL
  // stage is a dynamic import with ssr:false — so nothing needs a server.
  output: 'export',

  // Pages puts the site under /<repo>/. Without these, every chunk and every
  // .glb resolves to the domain root and 404s.
  basePath: isPages ? repo : undefined,
  assetPrefix: isPages ? repo : undefined,

  // Emits /path/index.html rather than /path.html, which is what Pages expects.
  trailingSlash: true,

  // next/image's optimiser needs a server; the export has none.
  images: { unoptimized: true },

  /*
   * Production builds write to their own directory.
   *
   * `next build` and `next dev` both default to .next, so running a build while
   * the dev server is up overwrites its chunk manifest and the running server
   * starts 404ing its own JavaScript — which looks exactly like a broken page.
   * `npm run build` sets BUILD_DIR so the two never collide.
   */
  distDir: process.env.BUILD_DIR || '.next',

  // three + r3f ship untranspiled ESM in a few subpaths; Next handles them via transpilePackages.
  transpilePackages: ['three'],

  webpack(config) {
    // Draco / KTX2 decoders are fetched at runtime from /public, never bundled.
    config.module.rules.push({ test: /\.(glb|gltf|ktx2)$/, type: 'asset/resource' })
    return config
  },
}

export default nextConfig
