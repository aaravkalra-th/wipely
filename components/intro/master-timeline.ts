import gsap from 'gsap'
import { sceneState, type SceneState } from '@/lib/scene-state'
import { COPY_IN, COPY_OUT, COPY_RISE, EASE, deg } from '@/lib/motion'
import { INTRO_LINES } from '@/content/copy'

/**
 * The master timeline.
 *
 * Everything the introduction does — camera, lighting, hand pose, contamination,
 * the product reveal and every line of DOM copy — is a tween on this one
 * timeline. Nothing animates on its own clock, which is what keeps the WebGL and
 * the DOM in lockstep whether the sequence is played, skipped or scrubbed.
 *
 * All positions are in metres. The set:
 *   doorway   centred on x=0 at z=-3.4, 2.25m tall
 *   console   x=1.75, z=-2.05, top at y=0.965
 *   basin     x=-2.15, z=-1.05, spout tip at (-2.15, 1.27, -1.10)
 *   hands     life size, roughly 0.1m across
 *
 * Labels, in order:
 *   enter-home, dirty-hands, wash-hands, clean-hands, touch-phone,
 *   transfer-germs, product-reveal, product-explanation, unlock-scroll
 */

export interface TimelineRefs {
  lines: Record<string, HTMLElement | null>
  steps: (HTMLElement | null)[]
  progress: HTMLElement | null
  cue: HTMLElement | null
  /** copy container, whose colour flips when the studio light arrives */
  ui: HTMLElement | null
  /** bottom gradient that keeps copy legible over the domestic set */
  scrim: HTMLElement | null
}

function camTo(
  tl: gsap.core.Timeline,
  at: number,
  dur: number,
  to: Partial<SceneState['cam']>,
  ease: string = EASE.camera
) {
  tl.to(sceneState.cam, { ...to, duration: dur, ease }, at)
}

export function buildMasterTimeline(refs: TimelineRefs, onLabel?: (l: string) => void) {
  const tl = gsap.timeline({ paused: true })

  // Read the live sub-objects at build time, never at module scope: the state
  // is reset immediately before this runs.
  const { cam, env, hands, germs, water, phone, product, person } = sceneState

  const addLine = (id: string, at: number, out: number) => {
    const el = refs.lines[id]
    if (!el) return
    tl.fromTo(
      el,
      { autoAlpha: 0, y: COPY_RISE },
      { autoAlpha: 1, y: 0, duration: COPY_IN, ease: EASE.copy },
      at
    )
    tl.to(el, { autoAlpha: 0, y: -COPY_RISE * 0.5, duration: COPY_OUT, ease: EASE.copy }, out)
  }
  for (const l of INTRO_LINES) addLine(l.id, l.in, l.out)

  /* ================================================================ */
  tl.addLabel('enter-home', 0)
  tl.call(() => onLabel?.('enter-home'), undefined, 0)

  /*
   * The door is opened by him.
   *
   * He crosses the door plane (z = -3.4) at about t=2.0, so the swing starts as
   * he reaches it and is still finishing as he steps through. Opening it on a
   * timer before he arrives reads as a haunted house.
   */
  tl.to(env, { door: 0.22, duration: 0.35, ease: 'power1.in' }, 0.95)
  tl.to(env, { door: 0.94, duration: 0.62, ease: 'power2.out' }, 1.3)

  /*
   * A person walks in through the lit doorway.
   *
   * Travel is 2.4m over 2.4s — almost exactly 1 m/s — which is matched to the
   * stride of the walk clip at its retimed speed so the feet do not skate. The
   * clip's playback head is tweened rather than left to run on wall clock, so
   * the walk scrubs and skips with the rest of the timeline.
   */
  tl.set(person, { present: 1 }, 0.15)
  tl.fromTo(
    person,
    { px: 0.08, py: 0, pz: -5.1, ry: 0, walk: 0 },
    /*
     * He walks up the middle at x=0.08. The leaf now swings a full 90 degrees
     * and parks flat at x=-0.55, outside the opening, so the lane is the whole
     * 1.44m doorway rather than a slot beside the door — see Room.tsx.
     *
     * Travel is 2.24m over 2.9s and the clip advances 2.24s, matching this
     * rig's ~1.04m stride per cycle so the feet do not skate.
     */
    { px: 0.08, pz: -2.86, walk: 2.24, duration: 2.9, ease: 'none' },
    0.3
  )

  /*
   * The near-foreground hand rises into frame from below, once he is inside.
   *
   * It starts well under the bottom edge and travels a real distance, so it
   * enters rather than materialising. An earlier version simply switched
   * `present` on and nudged the position, which popped.
   */
  tl.set(hands, { present: 1, solo: 1 }, 2.15)
  tl.fromTo(
    hands,
    { px: 0.84, py: 0.62, pz: 0.54, rx: -0.72, ry: -0.38, rz: -0.66, curl: 0.34 },
    {
      px: 0.62,
      py: 1.05,
      pz: 0.3,
      rx: -0.46,
      ry: -0.26,
      rz: -0.48,
      curl: 0.2,
      duration: 1.15,
      ease: 'power2.out',
    },
    2.15
  )

  // Contamination is already there; it only becomes legible as we approach.
  tl.fromTo(germs, { onHand: 0 }, { onHand: 0.72, duration: 1.1, ease: 'none' }, 2.3)

  // The person leaves frame as we move into the close-up on their hands.
  tl.to(person, { present: 0, duration: 0.01 }, 3.2)

  // The camera stays wide on the entrance and barely moves — the hand arriving
  // in the foreground is the event, not a camera move.
  camTo(tl, 0, 3, { px: 0.5, py: 1.13, pz: 0.72, tx: 0.1, ty: 1.32, tz: -3.0, fov: 42 })

  /* ================================================================ */
  tl.addLabel('dirty-hands', 3)
  tl.call(() => onLabel?.('dirty-hands'), undefined, 3)

  // Into a controlled close-up, with the background suppressed so the
  // contamination reads rather than competing with the room.
  // The second hand joins as we come in close; both are turned palms-to-camera.
  tl.to(
    hands,
    { px: 0.62, py: 1.0, pz: 0.16, rx: -0.1, ry: -0.1, rz: 0, curl: 0.1, apart: 0.26, duration: 1.4, ease: EASE.camera },
    3.3
  )
  tl.set(hands, { solo: 0 }, 3.5)
  camTo(tl, 3, 1.6, { px: 0.62, py: 1.04, pz: 0.94, tx: 0.62, ty: 1.0, tz: 0.16, fov: 30 })
  tl.to(env, { isolate: 1, duration: 1.2, ease: EASE.material }, 3.1)
  tl.to(germs, { onHand: 1, duration: 1.4, ease: 'none' }, 3.2)

  /* ================================================================ */
  tl.addLabel('wash-hands', 6)
  tl.call(() => onLabel?.('wash-hands'), undefined, 6)

  // Track across to the basin. The basin is in the same room, so this is one
  // continuous camera move and not a cut.
  tl.to(env, { isolate: 0, duration: 0.9, ease: EASE.material }, 6)
  camTo(tl, 6, 1.6, { px: -1.95, py: 1.62, pz: -0.3, tx: -2.15, ty: 1.24, tz: -0.94, fov: 34 })
  tl.to(
    hands,
    // Bowl rim is at y=1.115 and its front lip at z=-0.62. The hands sit above
    // the rim and forward of the bowl centre so the forearms clear the porcelain
    // instead of passing through it.
    /*
     * `apart` is much smaller here than in the palms-to-camera beats. Once the
     * hands turn to face each other their footprint across X is the hand's
     * THICKNESS (~60mm), not its splayed width (~200mm), so the separation that
     * reads as "just touching" is roughly a third of what it is elsewhere.
     */
    { px: -2.15, py: 1.27, pz: -0.9, rx: -0.78, ry: 0, rz: 0, apart: 0.085, curl: 0.24, duration: 1.6, ease: EASE.camera },
    6
  )

  tl.to(water, { flow: 1, duration: 0.5, ease: 'power2.out' }, 6.5)
  tl.to(hands, { wet: 1, duration: 1.0, ease: 'none' }, 6.9)
  tl.to(hands, { soap: 1, duration: 0.7, ease: 'power1.out' }, 7.4)

  // The scrub: a continuous rub cycle, eased in and out at the amplitude.
  tl.to(hands, { rubAmt: 1, duration: 0.5, ease: 'power1.inOut' }, 7.3)
  tl.to(hands, { rub: 7.5, duration: 2.6, ease: 'none' }, 7.3)
  tl.to(hands, { curl: 0.42, duration: 0.6, ease: 'power1.inOut' }, 7.3)

  // Contamination leaves in order — palms first, fingertips and nails last.
  tl.to(germs, { washed: 1, duration: 2.3, ease: 'power1.in' }, 7.2)

  tl.to(hands, { soap: 0, duration: 0.7, ease: 'power1.in' }, 9.1)
  tl.to(hands, { rubAmt: 0, curl: 0.16, apart: 0.26, duration: 0.6, ease: 'power1.inOut' }, 9.3)
  tl.to(water, { flow: 0, duration: 0.4, ease: 'power2.in' }, 9.5)

  /* ================================================================ */
  tl.addLabel('clean-hands', 10)
  tl.call(() => onLabel?.('clean-hands'), undefined, 10)

  // Hold on visibly clean hands. This pause is the tension, so nothing else is
  // allowed to move through it.
  camTo(tl, 9.9, 0.9, { px: -2.0, py: 1.52, pz: -0.36, tx: -2.15, ty: 1.26, tz: -0.92, fov: 32 })
  tl.to(hands, { wet: 0.3, duration: 0.8, ease: 'none' }, 10.0)

  /* ================================================================ */
  tl.addLabel('touch-phone', 10.8)
  tl.call(() => onLabel?.('touch-phone'), undefined, 10.8)

  /*
   * The phone beat happens at the ENTRY CONSOLE, not the basin.
   *
   * Staging it over the sink was always slightly wrong — nobody washes their
   * hands and then picks their phone up out of the bowl. The console at
   * x=1.75, z=-2.05 is where he put it down on the way in, which is the object
   * the room was built around in scene 1. The camera tracks across the room to
   * get there, so this is still one continuous move and not a cut.
   *
   * The phone is HELD above the console, not lying flat on it. Laying it on the
   * tabletop was tried and fails for the same reason the sink version did: with
   * a rigid hand, putting a fingertip on a phone flat on a surface drives the
   * rest of the palm straight through that surface. Held clear of the counter,
   * the hand has free space around it.
   */
  tl.set(phone, { present: 1 }, 10.6)
  tl.fromTo(
    phone,
    { px: 1.82, py: 0.99, pz: -1.72, rx: 0.72, ry: Math.PI, rz: -0.06 },
    /*
     * Position measured, not guessed: with the first-person pose the fingertips
     * land at roughly (1.63, 1.16, -1.53), so the handset is placed directly
     * under them. Authoring the phone somewhere else and letting the solver
     * close a 300mm gap is what dragged the hand across the frame in every
     * earlier version of this shot.
     *
     * Putting the handset under the fingers means the touch barely has to be
     * solved at all, so the authored pose survives.
     */
    { px: 1.82, py: 1.075, pz: -1.72, rx: 0.55, ry: Math.PI - 0.06, rz: -0.03, duration: 1.1, ease: EASE.camera },
    10.6
  )
  /*
   * FIRST PERSON. The camera is the person's eyes, so the hands must read as
   * HIS hands: forearms entering from the bottom of frame near the viewer,
   * outstretched away, fingertips at the far end on the glass.
   *
   * rx = -PI/2 with ry = PI is the rotation that does it. Composing
   * Rx(-90)*Ry(180) sends the finger axis (0,1,0) to (0,0,-1) — away from
   * camera — and the palm normal (0,0,1) to (0,-1,0) — down. So you see the
   * backs of your own hands, which is what you actually see reaching for a
   * phone. Every earlier version pointed the fingers toward the camera, which
   * is why they read as somebody else's hands coming at you.
   */
  tl.to(
    hands,
    {
      px: 1.82,
      py: 1.24,
      pz: -1.42,
      rx: -Math.PI / 2,
      ry: Math.PI,
      rz: 0,
      apart: 0.4,
      duration: 1.4,
      ease: EASE.camera,
    },
    10.6
  )

  /*
   * One long track across the room from the basin to the console — still a
   * continuous move, never a cut. The warm oak console reads differently from
   * the porcelain basin, which is the point: the phone beat should not look
   * like it is still happening at the sink.
   */
  camTo(tl, 10.6, 1.7, { px: 1.82, py: 1.58, pz: -1.08, tx: 1.84, ty: 1.09, tz: -1.82, fov: 44 })

  // The phone's own contamination only resolves at this distance.
  tl.to(germs, { onPhone: 1, duration: 1.2, ease: 'none' }, 11.2)

  // The reach, and the contact.
  tl.to(hands, { reach: 1, curl: 0.5, duration: 0.9, ease: 'power2.inOut' }, 11.5)
  // the reach: pushes further away from the viewer, onto the screen
  tl.to(hands, { py: 1.17, pz: -1.52, duration: 0.9, ease: 'power2.inOut' }, 11.6)
  // Hand-authored positions never quite land the fingertip on the glass, so the
  // last few millimetres are solved: touchLock drives the whole hand so the
  // right index fingertip sits exactly on the contact point. See TouchCorrection.
  /*
   * Deliberately solved only ~60% of the way.
   *
   * At full strength the fingertip lands exactly on the glass, which is
   * geometrically correct and looks wrong: the hand cannot fold, so the phone
   * body then hangs down through the palm. Stopping short leaves the fingertip
   * a few millimetres proud, which at this framing reads as contact while
   * keeping the handset clear of the hand. The contact highlight on the screen
   * sells the touch itself.
   */
  /*
   * Held at 0.45 on purpose, and this is the limit of what is achievable
   * without a rigged hand.
   *
   * Solved harder, the nearest fingertip does reach the glass — and because the
   * fingers cannot close, the handset is dragged inside the palm and disappears.
   * Solved lighter, the phone stays visible between the hands but the fingers
   * stop just short of it. There is no value that gives contact AND a visible
   * phone, because a rigid hand cannot wrap around anything.
   */
  tl.to(hands, { touchLock: 0.45, duration: 0.55, ease: 'power2.inOut' }, 12.1)
  /*
   * A macro insert at the moment of contact.
   *
   * The hand is not in frame when the fingertip would meet the glass, so the
   * rigid mesh is never asked to do the one thing it cannot. You see the
   * approach, then the consequence — which is how this cut is done anyway, and
   * what the brief asks for at this beat. It stays correct if the hand is
   * rigged later.
   */
  camTo(tl, 12.35, 0.45, { px: 1.83, py: 1.2, pz: -1.5, tx: 1.82, ty: 1.07, tz: -1.72, fov: 26 })
  tl.fromTo(phone, { contact: 0 }, { contact: 1, duration: 0.9, ease: EASE.impulse }, 12.5)
  // back out to the hands, which are the subject again as the germs land
  camTo(tl, 13.05, 0.7, { px: 1.82, py: 1.58, pz: -1.08, tx: 1.84, ty: 1.09, tz: -1.82, fov: 44 })

  /* ================================================================ */
  tl.addLabel('transfer-germs', 13)
  tl.call(() => onLabel?.('transfer-germs'), undefined, 13)

  // Transfer follows the contact area, spreading outward from the fingertip.
  tl.to(germs, { transfer: 1, duration: 2.0, ease: 'power1.inOut' }, 12.9)
  tl.to(hands, { touchLock: 0, duration: 0.5, ease: 'power2.inOut' }, 13.5)
  tl.to(hands, { reach: 0.3, py: 1.26, pz: -1.4, duration: 0.9, ease: 'power2.inOut' }, 13.6)

  // Pull back and let it move across the hand.
  camTo(tl, 13.6, 1.6, { px: 1.82, py: 1.62, pz: -1.0, tx: 1.84, ty: 1.14, tz: -1.78, fov: 46 })
  tl.to(germs, { spread: 1, duration: 1.5, ease: 'power1.out' }, 13.8)

  // The lighting begins its change from domestic warmth to product neutral.
  tl.to(cam, { studio: 1, duration: 2.2, ease: EASE.material }, 14.3)
  if (refs.ui) tl.to(refs.ui, { color: '#1d1d1f', duration: 1.8, ease: EASE.material }, 14.6)
  if (refs.scrim) tl.to(refs.scrim, { opacity: 0, duration: 1.6, ease: EASE.material }, 14.4)
  tl.to(phone, { present: 0, duration: 0.01 }, 15.7)

  /* ================================================================ */
  tl.addLabel('product-reveal', 15.4)
  tl.call(() => onLabel?.('product-reveal'), undefined, 15.4)

  // One particle leaves the hand and crosses the frame; the camera rides it in.
  tl.to(germs, { tracer: 1, duration: 1.5, ease: 'power1.inOut' }, 15.0)
  tl.to(germs, { onHand: 0, spread: 0, transfer: 0, duration: 0.6, ease: 'none' }, 16.1)
  tl.to(hands, { present: 0, duration: 0.01 }, 16.7)

  camTo(tl, 15.4, 2.3, { px: 0.06, py: 1.3, pz: 0.36, tx: 0, ty: 1.26, tz: 0, fov: 32 })

  // Silhouette first, then a narrow edge light, then the material.
  tl.set(product, { reveal: 1, light: 0 }, 15.5)
  tl.fromTo(
    product,
    { ry: deg(-15), rx: deg(5), rz: 0, px: 0, py: 1.25, pz: 0 },
    { ry: deg(9), rx: deg(2), duration: 2.4, ease: EASE.camera },
    15.6
  )
  tl.fromTo(product, { light: 0 }, { light: 1, duration: 1.8, ease: EASE.material }, 15.8)

  /* ================================================================ */
  /*
   * THE WIPE. The contaminated phone comes back alongside the product and a
   * sheet is drawn across it: the glass clears behind the leading edge, then
   * the hands follow.
   *
   * Deliberately a mechanism demonstration, not a fight. It shows only what the
   * product physically does — a sheet passes over a surface and lifts what is
   * on it — and makes no claim about killing or neutralising anything.
   */
  tl.addLabel('wipe-demo', 17.6)
  tl.call(() => onLabel?.('wipe-demo'), undefined, 17.6)

  // phone and hands return, still contaminated, beside the product
  tl.set(phone, { present: 1 }, 17.55)
  tl.fromTo(
    phone,
    { px: 0.3, py: 1.2, pz: 0.44, rx: 0.36, ry: Math.PI - 0.3, rz: -0.08 },
    { px: 0.26, py: 1.25, pz: 0.46, rx: 0.3, ry: Math.PI - 0.24, rz: -0.05, duration: 1.0, ease: EASE.camera },
    17.55
  )
  tl.to(germs, { onPhone: 1, onHand: 0.8, duration: 0.5, ease: 'none' }, 17.6)
  tl.to(product, { px: -0.24, py: 1.24, pz: 0.34, duration: 1.0, ease: EASE.camera }, 17.6)
  camTo(tl, 17.6, 1.2, { px: 0.05, py: 1.36, pz: 1.42, tx: 0.02, ty: 1.24, tz: 0.36, fov: 38 })

  // a sheet is drawn from the pad and swept across the glass
  tl.to(product, { peel: 1, duration: 0.7, ease: 'power2.out' }, 18.5)
  tl.fromTo(product, { wipe: 0 }, { wipe: 1, duration: 1.5, ease: 'power1.inOut' }, 19.0)
  tl.fromTo(germs, { wiped: 0 }, { wiped: 1, duration: 1.9, ease: 'none' }, 19.05)

  // clean phone, clean hands, held for a beat
  tl.to(phone, { present: 0, duration: 0.01 }, 21.4)
  tl.to(germs, { onHand: 0, onPhone: 0, duration: 0.01 }, 21.45)
  tl.to(product, { peel: 0.5, px: 0, py: 1.25, pz: 0, duration: 1.0, ease: EASE.camera }, 21.0)

  /* ================================================================ */
  tl.addLabel('product-explanation', 21.6)
  tl.call(() => onLabel?.('product-explanation'), undefined, 21.6)

  // The mechanism, shown rather than claimed: a sheet drawn from the pocket.
  tl.to(product, { peel: 1, duration: 1.2, ease: 'power2.out' }, 21.65)
  camTo(tl, 21.6, 1.4, { px: 0.02, py: 1.42, pz: 2.42, tx: 0, ty: 1.25, tz: 0, fov: 32 })

  refs.steps.forEach((el, i) => {
    if (!el) return
    tl.fromTo(
      el,
      { autoAlpha: 0, y: COPY_RISE * 0.8 },
      { autoAlpha: 1, y: 0, duration: 0.7, ease: EASE.copy },
      21.75 + i * 0.42
    )
  })

  /* ================================================================ */
  tl.addLabel('unlock-scroll', 23.2)
  tl.call(() => onLabel?.('unlock-scroll'), undefined, 23.2)

  // Settle into the framing the preserved section opens on: the same raised
  // three-quarter angle, so the handoff reads as one continuous camera.
  tl.to(product, { peel: 0.5, rx: deg(21), ry: deg(7), duration: 1.1, ease: EASE.camera }, 22.9)
  camTo(tl, 22.9, 1.1, { px: 0.15, py: 1.42, pz: 0.33, tx: 0, ty: 1.25, tz: 0, fov: 32 })
  tl.to(sceneState, { handoff: 1, duration: 0.9, ease: EASE.material }, 23.0)

  if (refs.cue) {
    tl.fromTo(
      refs.cue,
      { autoAlpha: 0, y: 12 },
      { autoAlpha: 1, y: 0, duration: 0.7, ease: EASE.copy },
      23.5
    )
  }

  // Progress is driven by the timeline itself, so it can never disagree with
  // what is on screen.
  if (refs.progress) {
    tl.fromTo(
      refs.progress,
      { scaleX: 0 },
      { scaleX: 1, duration: tl.duration() || 20.6, ease: 'none' },
      0
    )
  }

  return tl
}
