/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
