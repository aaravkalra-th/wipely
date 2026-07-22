/**
 * The single bridge between GSAP and React Three Fiber.
 *
 * GSAP owns the master timeline and tweens the plain numbers below.
 * R3F reads them inside useFrame and applies them to the scene graph.
 *
 * Nothing here is React state: the 20-second sequence must not cause a single
 * re-render. Anything that genuinely needs to change the DOM goes through the
 * timeline's own callbacks instead.
 *
 * Every transform is exposed as a flat number rather than being derived inside
 * a component, so the timeline stays the only place choreography is authored.
 */

export interface Placement {
  px: number
  py: number
  pz: number
  rx: number
  ry: number
  rz: number
}

export interface SceneState {
  cam: {
    px: number
    py: number
    pz: number
    tx: number
    ty: number
    tz: number
    fov: number
    /** 0 = domestic warm interior, 1 = neutral product studio */
    studio: number
  }

  env: {
    /** doorway swing, 0 shut .. 1 open */
    door: number
    /** 0 normal, 1 background suppressed so contamination reads clearly */
    isolate: number
    exposure: number
  }

  hands: Placement & {
    present: number
    /** finger curl, 0 open .. 1 closed */
    curl: number
    /** thumb curl */
    thumb: number
    /** separation between the two hands */
    apart: number
    /** rubbing cycle position, in cycles */
    rub: number
    /** rub amplitude */
    rubAmt: number
    wet: number
    soap: number
    /** index finger extended to touch, 0..1 */
    reach: number
    /** 1 = only the right hand is in shot, 0 = both */
    solo: number
    /** 0..1 — pins the right index fingertip onto the phone's contact point */
    touchLock: number
  }

  germs: {
    onHand: number
    onPhone: number
    /** ordered removal during the wash */
    washed: number
    /** phone -> hand transfer within the contact area */
    transfer: number
    /** the tracked particle that carries us into the reveal */
    tracer: number
    /** spread across the hand after transfer */
    spread: number
    /**
     * The wipe pass, 0..1. Contamination vanishes as the sheet's leading edge
     * passes over it: the phone clears through the first half, the hands
     * through the second. Same ordered mechanic as `washed`, different axis.
     */
    wiped: number
  }

  /** the person who comes home; scene 1 only */
  person: Placement & {
    present: number
    /** playback head for the walk clip, in seconds, driven by the timeline */
    walk: number
  }

  water: { flow: number }

  phone: Placement & {
    present: number
    /** contact highlight impulse */
    contact: number
  }

  product: Placement & {
    reveal: number
    /** silhouette -> edge light -> full material */
    light: number
    /** sectional separation */
    section: number
    /** demonstration peel */
    peel: number
    /** the sheet's sweep across the phone, 0 parked .. 1 fully across */
    wipe: number
  }

  /** pointer parallax, degrees, clamped to +/-2 by the input handler */
  parallax: { x: number; y: number }

  handoff: number
}

const place = (px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0): Placement => ({
  px,
  py,
  pz,
  rx,
  ry,
  rz,
})

export function createSceneState(): SceneState {
  return {
    cam: { px: 0.5, py: 1.02, pz: 3.1, tx: 0, ty: 1.5, tz: -3.2, fov: 40, studio: 0 },
    env: { door: 0, isolate: 0, exposure: 1 },
    hands: {
      ...place(0.2, 1.02, -1.4, -0.5, 0, 0),
      present: 0,
      curl: 0.18,
      thumb: 0.12,
      apart: 0.5,
      rub: 0,
      rubAmt: 0,
      wet: 0,
      soap: 0,
      reach: 0,
      solo: 1,
      touchLock: 0,
    },
    germs: { onHand: 0, onPhone: 0, washed: 0, transfer: 0, tracer: 0, spread: 0, wiped: 0 },
    person: { ...place(0, 0, -5.1), present: 0, walk: 0 },
    water: { flow: 0 },
    phone: { ...place(0, -4, 0), present: 0, contact: 0 },
    product: { ...place(0, 1.25, 0), reveal: 0, light: 0, section: 0, peel: 0, wipe: 0 },
    parallax: { x: 0, y: 0 },
    handoff: 0,
  }
}

/** Module-level singleton. One sequence per page, so one state object. */
export const sceneState = createSceneState()

// Dev-only handle so the sequence can be inspected and scrubbed from a console.
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  ;(window as unknown as { sceneState: SceneState }).sceneState = sceneState
}

/**
 * Restores the opening pose.
 *
 * This assigns into each nested object rather than replacing it. The timeline
 * holds direct references to `sceneState.cam`, `sceneState.hands` and so on, so
 * swapping those objects out would leave GSAP animating orphans while the scene
 * reads the replacements — the sequence would appear completely frozen.
 */
export function resetSceneState() {
  const fresh = createSceneState()
  for (const key of Object.keys(fresh) as (keyof SceneState)[]) {
    const next = fresh[key]
    if (typeof next === 'object' && next !== null) {
      Object.assign(sceneState[key] as object, next)
    } else {
      // primitives (handoff)
      ;(sceneState as unknown as Record<string, unknown>)[key] = next
    }
  }
}
