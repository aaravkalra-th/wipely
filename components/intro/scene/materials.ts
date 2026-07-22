import * as THREE from 'three'

/**
 * Shared materials and geometries.
 *
 * Every mesh in the introduction pulls from here so that nothing is allocated
 * per-instance and everything can be disposed in one pass when the canvas
 * unmounts. Colours come from the same five-value palette as the CSS.
 */

export const PALETTE = {
  bg: 0xf4f5f7,
  surface: 0xe7e9ee,
  ink: 0x1d1d1f,
  /*
   * Bright green, on request, to make contamination unmissable.
   *
   * Worth recording: the brief asked for restrained, organic contamination with
   * "restrained emissive highlights" and no cartoon-germ register. This is a
   * deliberate override in favour of legibility — at the muted olive the
   * particles were physically plausible and effectively invisible at these
   * framings. Reverting is a one-line change here.
   */
  contam: 0x2bff5a,
  accent: 0x0a84ff,
  skin: 0xc9a189,
  // Neutral plaster and a mid oak floor. Kept desaturated so the warm key light
  // does the colouring rather than the albedo — otherwise everything reads as
  // one flat wash of beige.
  wall: 0xe4e2de,
  floor: 0x7d6b58,
  trim: 0xf3f1ee,
  porcelain: 0xf2f3f4,
  chrome: 0xbcc0c6,
  phoneBody: 0x1c1c1e,
  padBlue: 0x9db9e6,
  sheet: 0xfcfdff,
} as const

const registry: { dispose(): void }[] = []
function track<T extends { dispose(): void }>(x: T): T {
  registry.push(x)
  return x
}

/* ---------------------------------- materials --------------------------- */

export const M = {
  /*
   * Skin.
   *
   * Physical rather than standard so the wash can add a wet clearcoat. The
   * warm sheen and the thin-film transmission stand in for subsurface
   * scattering: real skin is translucent at the fingertips and edges, and
   * without something faking that it reads as painted plastic. This is far
   * cheaper than actual transmission and survives on integrated GPUs.
   */
  skin: track(
    new THREE.MeshPhysicalMaterial({
      color: PALETTE.skin,
      roughness: 0.58,
      metalness: 0,
      clearcoat: 0,
      clearcoatRoughness: 0.35,
      sheen: 0.7,
      sheenRoughness: 0.55,
      sheenColor: new THREE.Color(0xd98a72),
      // a little forward scatter through thin geometry — fingertips, webbing
      thickness: 0.006,
      attenuationColor: new THREE.Color(0xb84a3a),
      attenuationDistance: 0.02,
    })
  ),

  /** fingernails — subtly cooler and glossier than the skin around them */
  nail: track(
    new THREE.MeshPhysicalMaterial({
      color: 0xe8c3b2,
      roughness: 0.28,
      metalness: 0,
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
    })
  ),

  wall: track(new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 0.95 })),
  floor: track(new THREE.MeshStandardMaterial({ color: PALETTE.floor, roughness: 0.65 })),
  trim: track(new THREE.MeshStandardMaterial({ color: PALETTE.trim, roughness: 0.6 })),

  porcelain: track(
    new THREE.MeshPhysicalMaterial({
      color: PALETTE.porcelain,
      roughness: 0.18,
      clearcoat: 0.7,
      clearcoatRoughness: 0.15,
    })
  ),

  chrome: track(
    new THREE.MeshPhysicalMaterial({
      color: PALETTE.chrome,
      metalness: 0.95,
      roughness: 0.16,
    })
  ),

  phoneBody: track(
    new THREE.MeshPhysicalMaterial({
      color: PALETTE.phoneBody,
      metalness: 0.55,
      roughness: 0.42,
      clearcoat: 0.6,
      clearcoatRoughness: 0.35,
    })
  ),

  phoneGlass: track(
    new THREE.MeshPhysicalMaterial({
      color: 0x0a0a0c,
      metalness: 0.2,
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    })
  ),

  pad: track(
    new THREE.MeshPhysicalMaterial({
      color: PALETTE.padBlue,
      roughness: 0.62,
      sheen: 0.6,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color(0xdbe6ff),
      clearcoat: 0.15,
      clearcoatRoughness: 0.5,
    })
  ),

  sheet: track(
    new THREE.MeshPhysicalMaterial({
      color: PALETTE.sheet,
      roughness: 0.9,
      sheen: 0.5,
      sheenRoughness: 0.7,
      side: THREE.DoubleSide,
    })
  ),

  /*
   * Contamination.
   *
   * Reads as damp organic matter, not as glowing sci-fi spheres. It needs to
   * survive being seen against skin, against black glass and against a dark
   * isolation scrim, so it carries its own specular response: the wet highlight
   * is what actually makes a sub-millimetre particle visible at these framings,
   * far more than colour does.
   */
  germ: track(
    new THREE.MeshPhysicalMaterial({
      color: PALETTE.contam,
      roughness: 0.3,
      metalness: 0,
      clearcoat: 0.8,
      clearcoatRoughness: 0.2,
      transparent: false,
      opacity: 1,
      emissive: new THREE.Color(PALETTE.contam),
      // pulsed every frame in GermField; this is only the starting value
      emissiveIntensity: 0.9,
      depthWrite: true,
    })
  ),
}

/* --------------------------------- geometries --------------------------- */

export const G = {
  /** one low-poly blob, instanced a few hundred times for contamination */
  germ: track(new THREE.IcosahedronGeometry(1, 1)),
  box: track(new THREE.BoxGeometry(1, 1, 1)),
  plane: track(new THREE.PlaneGeometry(1, 1)),
  /** finger segment: a capsule, reused at every joint with per-node scale */
  phalanx: track(new THREE.CapsuleGeometry(1, 1, 4, 12)),
  cyl: track(new THREE.CylinderGeometry(1, 1, 1, 24)),
  sphere: track(new THREE.SphereGeometry(1, 20, 14)),
}

/**
 * A finger segment, as a lathed profile rather than a capsule.
 *
 * A capsule is a cylinder with hemispherical caps and constant radius, which is
 * why the first version of the hand read as sausages. A real phalanx tapers
 * from base to tip, swells slightly at the mid-shaft, and has a flatter tip
 * than a hemisphere. The profile below does all three, and the caller squashes
 * it in Z because fingers are wider than they are deep.
 *
 * Geometries are cached by dimension: there are only about fourteen distinct
 * sizes across both hands.
 */
const phalanxCache = new Map<string, THREE.LatheGeometry>()

export function phalanxGeometry(len: number, rBase: number, rTip: number) {
  const key = `${len.toFixed(4)}:${rBase.toFixed(4)}:${rTip.toFixed(4)}`
  const hit = phalanxCache.get(key)
  if (hit) return hit

  const capB = rBase * 0.72
  const capT = rTip * 0.88
  const pts: THREE.Vector2[] = []

  // rounded base
  for (let i = 0; i <= 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * (Math.PI / 2)
    pts.push(new THREE.Vector2(Math.cos(a) * rBase, capB + Math.sin(a) * capB))
  }
  // shaft: linear taper with a subtle mid swell
  const segs = 6
  const shaft = Math.max(len - capB - capT, 0.001)
  for (let i = 1; i <= segs; i++) {
    const t = i / segs
    const swell = 1 + 0.07 * Math.sin(t * Math.PI)
    pts.push(new THREE.Vector2((rBase + (rTip - rBase) * t) * swell, capB + t * shaft))
  }
  // flattened tip
  for (let i = 1; i <= 5; i++) {
    const a = (i / 5) * (Math.PI / 2)
    pts.push(new THREE.Vector2(Math.cos(a) * rTip, len - capT + Math.sin(a) * capT))
  }

  const geo = new THREE.LatheGeometry(pts, 16)
  geo.computeVertexNormals()
  phalanxCache.set(key, geo)
  return track(geo)
}

/** Rounded-rectangle extrusion, used for the phone and the product shells. */
export function roundedBoxGeometry(w: number, h: number, d: number, r: number, bevel = 0.012) {
  const shape = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  shape.moveTo(x + r, y)
  shape.lineTo(x + w - r, y)
  shape.quadraticCurveTo(x + w, y, x + w, y + r)
  shape.lineTo(x + w, y + h - r)
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  shape.lineTo(x + r, y + h)
  shape.quadraticCurveTo(x, y + h, x, y + h - r)
  shape.lineTo(x, y + r)
  shape.quadraticCurveTo(x, y, x + r, y)

  // Bevel adds thickness beyond `depth` at BOTH ends, so the requested depth is
  // reduced up front and the bevel is clamped. This is the bug that made the
  // original panels render three times thicker than specified.
  const b = Math.min(bevel, d * 0.25)
  const core = Math.max(d - b * 2, 0.001)
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: core,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    steps: 1,
  })
  geo.translate(0, 0, -core / 2)
  geo.computeVertexNormals()
  return track(geo)
}

export function disposeShared() {
  for (const item of registry) item.dispose()
  registry.length = 0
}
