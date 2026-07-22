'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { G, M, PALETTE } from './materials'
import type { HandAnchor } from './Hand'
import { sceneState } from '@/lib/scene-state'

/**
 * Contamination, as one InstancedMesh.
 *
 * Every particle's position and scale is a pure function of the timeline state.
 * There is no integration, no internal velocity, no random walk that advances
 * on its own. That is deliberate: the timeline can be scrubbed, skipped to the
 * end, or replayed and the field always resolves to the same frame.
 *
 * The wash is ordered, not a global fade. Each particle carries its own
 * `washAt` threshold derived from where it sits on the hand, so the palms clear
 * before the webbing, which clears before the nails and fingertips — the same
 * order a person actually scrubs in.
 */

const COUNT = 460
/** how many of those live on the phone rather than the hands */
const PHONE_COUNT = 130

/** radius around the fingertip contact point that actually transfers */
/*
 * Large enough to cover the whole screen, so EVERY particle on the glass
 * migrates. Transferring only a patch was accurate and unreadable — the beat
 * the entire sequence is built around has to be unmistakable.
 */
const CONTACT_RADIUS = 2.6

interface Germ {
  onPhone: boolean
  anchorIdx: number
  /** destination anchor on the hand when this particle transfers */
  destIdx: number
  off: THREE.Vector3
  scale: number
  /** appearance order, 0..1 */
  showAt: number
  /** wash removal order, 0..1 — lower washes off first */
  washAt: number
  /** transfer order, 0..1, or Infinity if outside the contact area */
  moveAt: number
  /**
   * When the wipe clears this particle, 0..1 along `germs.wiped`.
   * Phone particles clear in the first half as the sheet crosses the screen;
   * hand particles in the second, so the phone visibly gets cleaned first and
   * the hands follow.
   */
  wipeAt: number
  drift: THREE.Vector3
  phase: number
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / Math.max(edge1 - edge0, 1e-6)))
  return t * t * (3 - 2 * t)
}

/** deterministic pseudo-random so every reload composes identically */
function mulberry(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * How readily each region gives up its contamination during a wash.
 * Palms and the backs of the hands go first; nails and fingertips last.
 */
const WASH_BIAS: Record<HandAnchor['region'], [number, number]> = {
  palm: [0.0, 0.3],
  back: [0.1, 0.4],
  web: [0.3, 0.62],
  nail: [0.55, 0.88],
  tip: [0.62, 1.0],
}

export interface GermFieldProps {
  handAnchors: React.MutableRefObject<HandAnchor[]>
  phoneRef: React.MutableRefObject<THREE.Object3D | null>
  /** local-space rect on the phone face that particles populate */
  phoneFace: { w: number; h: number; z: number }
  /** where the fingertip lands, in phone-local space */
  contactPoint: [number, number]
  /** world-space destination for the tracked particle in scene 6 */
  tracerTarget: [number, number, number]
}

export function GermField({
  handAnchors,
  phoneRef,
  phoneFace,
  contactPoint,
  tracerTarget,
}: GermFieldProps) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const v2 = useMemo(() => new THREE.Vector3(), [])
  const phonePts = useRef<THREE.Vector3[]>([])

  const germs = useMemo<Germ[]>(() => {
    const rnd = mulberry(0x77c0de)
    const list: Germ[] = []
    const contact = new THREE.Vector2(contactPoint[0], contactPoint[1])

    for (let i = 0; i < COUNT; i++) {
      const onPhone = i < PHONE_COUNT
      const g: Germ = {
        onPhone,
        anchorIdx: i,
        destIdx: 0,
        // All distances are in metres, matching the life-size hand rig.
        off: new THREE.Vector3(
          (rnd() - 0.5) * 0.007,
          (rnd() - 0.5) * 0.007,
          (rnd() - 0.5) * 0.003
        ),
        // Sized to actually read at these framings. The previous values were
        // technically plausible and visually invisible.
        scale: rnd() < 0.3 ? 0.0026 + rnd() * 0.0022 : 0.0011 + rnd() * 0.0013,
        showAt: rnd() * 0.85,
        washAt: 0,
        moveAt: Infinity,
        wipeAt: 0,
        drift: new THREE.Vector3(rnd() - 0.5, -0.4 - rnd() * 0.6, rnd() - 0.5).normalize(),
        phase: rnd() * Math.PI * 2,
      }
      list.push(g)
    }

    // Phone particles get a position on the screen face, and their transfer
    // order is purely a function of distance from the fingertip contact point.
    for (let i = 0; i < PHONE_COUNT; i++) {
      const g = list[i]
      const p = new THREE.Vector3(
        (rnd() - 0.5) * phoneFace.w,
        (rnd() - 0.5) * phoneFace.h,
        phoneFace.z + rnd() * 0.004
      )
      phonePts.current.push(p)
      g.anchorIdx = i
      // sheet sweeps from the top of the screen downward, so a particle's wipe
      // order is just how far down the glass it sits
      const down = 1 - (p.y / phoneFace.h + 0.5)
      g.wipeAt = 0.05 + Math.min(Math.max(down, 0), 1) * 0.5

      const d = Math.hypot(p.x - contact.x, p.y - contact.y)
      g.moveAt = d < CONTACT_RADIUS ? d / CONTACT_RADIUS : Infinity
      /*
       * Phone contamination is deliberately an order smaller than what sits on
       * skin. The brief wants a phone that reads as used, not destroyed — at
       * the previous size these covered the screen like caviar and made a
       * premium object look filthy.
       */
      g.scale *= 0.3
    }

    return list
  }, [contactPoint, phoneFace.h, phoneFace.w, phoneFace.z])

  // Per-instance colour variation, written once.
  useEffect(() => {
    const m = mesh.current
    if (!m) return
    const base = new THREE.Color(PALETTE.contam)
    const c = new THREE.Color()
    const rnd = mulberry(0x1234)
    for (let i = 0; i < COUNT; i++) {
      c.copy(base)
      c.offsetHSL((rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.18, (rnd() - 0.5) * 0.22)
      m.setColorAt(i, c)
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [])

  // Assign each hand particle to a real anchor once the hands have mounted and
  // registered theirs, and derive its wash order from that anchor's region.
  /**
   * How likely each region is to be chosen. Contamination is not evenly
   * distributed over a hand — it concentrates where you actually make contact.
   */
  const REGION_WEIGHT: Record<HandAnchor['region'], number> = {
    tip: 4.2,
    nail: 2.6,
    web: 1.6,
    palm: 2.2,
    back: 0.7,
  }

  const bound = useRef(false)
  const bind = () => {
    const anchors = handAnchors.current
    if (bound.current || anchors.length === 0) return
    const rnd = mulberry(0xbeef)

    // Weighted pick, so fingertips and nails carry most of it.
    const weights = anchors.map((a) => REGION_WEIGHT[a.region] ?? 1)
    const total = weights.reduce((s, w) => s + w, 0)
    const pick = () => {
      let r = rnd() * total
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i]
        if (r <= 0) return i
      }
      return weights.length - 1
    }

    const tips = anchors.filter((x) => x.region === 'tip')

    /*
     * Particles are assigned in CLUSTERS of 3-7 sharing one anchor, rather than
     * one anchor each. Scattering every particle independently produces an even
     * dusting that reads as noise; real contamination sits in clumps, and a
     * clump is legible at a distance where a single speck is not.
     */
    let i = 0
    while (i < COUNT) {
      const idx = pick()
      const a = anchors[idx]
      const clump = 3 + Math.floor(rnd() * 5)
      const [lo, hi] = WASH_BIAS[a.region]
      // one wash threshold per cluster, so clumps lift off together
      const washAt = lo + rnd() * (hi - lo)

      for (let k = 0; k < clump && i < COUNT; k++, i++) {
        const g = germs[i]
        if (g.onPhone) {
          const t = tips.length ? tips[Math.floor(rnd() * tips.length)] : a
          g.destIdx = anchors.indexOf(t)
        } else {
          g.anchorIdx = idx
          g.washAt = Math.min(1, washAt + (rnd() - 0.5) * 0.06)
          // hands are wiped after the phone: second half of the pass
          g.wipeAt = 0.5 + a.across * 0.42 + rnd() * 0.06
        }
      }
    }
    bound.current = true
  }

  useFrame((_, dt) => {
    const m = mesh.current
    if (!m) return
    bind()

    const anchors = handAnchors.current
    if (anchors.length === 0) {
      m.count = 0
      return
    }
    m.count = COUNT

    const s = sceneState
    const t = performance.now() * 0.001

    /*
     * Global emissive pulse. Shared material, so this is one write per frame
     * rather than per particle. Deliberately driven from wall clock rather than
     * the timeline: it is an attention cue, not story state, and it should keep
     * breathing even when the sequence is paused or being scrubbed.
     */
    M.germ.emissiveIntensity = 0.62 + 0.85 * (0.5 + 0.5 * Math.sin(t * 3.6))
    const soloNow = s.hands.solo > 0.5

    // World matrices must be current before we read anchor positions: R3F
    // flushes them at render time, which is after this callback.
    if (anchors[0]?.node.parent) anchors[0].node.updateWorldMatrix(true, false)
    const phone = phoneRef.current
    if (phone) phone.updateWorldMatrix(true, false)

    for (let i = 0; i < COUNT; i++) {
      const g = germs[i]
      let alive: number
      let scale = g.scale

      if (g.onPhone) {
        const appear = smoothstep(g.showAt - 0.2, g.showAt, s.germs.onPhone)
        // Only particles inside the contact radius move, and they move in the
        // order the contact spreads outward from the fingertip.
        const moved =
          g.moveAt === Infinity ? 0 : smoothstep(g.moveAt, g.moveAt + 0.3, s.germs.transfer)

        const local = phonePts.current[g.anchorIdx]
        v.copy(local)
        if (phone) v.applyMatrix4(phone.matrixWorld)

        if (moved > 0) {
          const dest = anchors[Math.min(g.destIdx, anchors.length - 1)]
          dest.node.updateWorldMatrix(true, false)
          v2.copy(g.off).multiplyScalar(0.6).applyMatrix4(dest.node.matrixWorld)
          // arc the hop rather than sliding it in a straight line
          const hop = Math.sin(moved * Math.PI) * 0.055
          v.lerp(v2, moved)
          v.y += hop
        }

        // once on the hand, the spread pass walks them outward a little
        if (moved > 0.9 && s.germs.spread > 0) {
          v.addScaledVector(g.drift, s.germs.spread * 0.012 * (0.4 + g.phase * 0.1))
        }

        /*
         * Transferred particles GROW on the way across.
         *
         * On glass they are deliberately tiny — a phone should read as used,
         * not filthy. But at that size the transfer itself is invisible, which
         * is the one moment the whole sequence is built around. Scaling them up
         * as they migrate makes the movement legible and lands them at the same
         * size as the contamination that was on the hands earlier.
         */
        if (moved > 0) scale = g.scale * (1 + moved * 3.4)

        alive = appear
      } else {
        const appear = smoothstep(g.showAt - 0.2, g.showAt, s.germs.onHand)
        const washed = smoothstep(g.washAt, g.washAt + 0.16, s.germs.washed)

        const a = anchors[Math.min(g.anchorIdx, anchors.length - 1)]

        // A hand that is out of shot must not leave its contamination hanging
        // in mid-air where the hand used to be.
        if (soloNow && a.side === 'left') {
          dummy.position.set(0, -999, 0)
          dummy.scale.setScalar(0.0001)
          dummy.updateMatrix()
          m.setMatrixAt(i, dummy.matrix)
          continue
        }

        a.node.updateWorldMatrix(true, false)
        v.copy(g.off).applyMatrix4(a.node.matrixWorld)

        // Washed particles break away and are carried off, they do not just
        // dim in place.
        if (washed > 0) {
          v.addScaledVector(g.drift, washed * 0.055)
          v.y -= washed * washed * 0.09
        }

        // very small idle motion so the field reads as matter, not decals
        v.x += Math.sin(t * 0.7 + g.phase) * 0.0002
        v.z += Math.cos(t * 0.6 + g.phase) * 0.0002

        alive = appear * (1 - washed)
      }

      // The tracked particle for the scene-6 transition: instance 0 leaves the
      // hand and crosses the frame, and the camera follows it to the product.
      if (i === 0 && s.germs.tracer > 0) {
        const p = s.germs.tracer
        v2.set(tracerTarget[0], tracerTarget[1], tracerTarget[2])
        v.lerp(v2, p * p * (3 - 2 * p))
        v.y += Math.sin(p * Math.PI) * 0.12
        alive = Math.max(alive, 1 - smoothstep(0.82, 1, p))
        // enlarged so a sub-millimetre particle can carry a shot on its own
        scale = 0.0022
      }

      /*
       * The wipe. Applied last so it overrides everything else: whatever a
       * particle was doing — sitting, transferring, spreading — it disappears
       * once the sheet has passed over it.
       */
      if (s.germs.wiped > 0) {
        alive *= 1 - smoothstep(g.wipeAt, g.wipeAt + 0.1, s.germs.wiped)
      }

      if (alive <= 0.001) {
        dummy.position.set(0, -999, 0)
        dummy.scale.setScalar(0.0001)
      } else {
        dummy.position.copy(v)
        // per-particle size pulse, phase-offset so they do not throb in unison
        const beat = 1 + 0.2 * Math.sin(t * 4.2 + g.phase)
        dummy.scale.setScalar(scale * alive * beat)
        dummy.rotation.set(g.phase + t * 0.15, g.phase * 2, 0)
      }
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }

    m.instanceMatrix.needsUpdate = true
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    dt
  })

  return (
    <instancedMesh
      ref={mesh}
      args={[G.germ, M.germ, COUNT]}
      frustumCulled={false}
    />
  )
}
