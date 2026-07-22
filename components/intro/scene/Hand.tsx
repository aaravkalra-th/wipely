'use client'

import { forwardRef, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { G, M, phalanxGeometry, roundedBoxGeometry } from './materials'

/**
 * A procedural hand, built at life size.
 *
 * The whole scene is in metres — the doorway is 2.25m, the counter is 0.96m —
 * so the hand is too: an 85mm palm, 82mm middle finger, 26mm across the knuckles.
 * Getting this wrong is not a cosmetic problem, it changes the meaning of every
 * camera distance in the timeline.
 *
 * No character asset ships with this project, so there is no body. Rather than
 * float a pair of disembodied hands through a room, the rig carries a forearm
 * that runs out of frame, and the wide shots keep the hands near the frame edge
 * so they read as belonging to someone standing just outside the shot.
 *
 * Germ anchors are real Object3D nodes parented to the fingertips, the webbing
 * and the palm, so contamination tracks the pose rather than floating in
 * hand-local space.
 */

export type AnchorRegion = 'tip' | 'nail' | 'web' | 'palm' | 'back'

export interface HandAnchor {
  node: THREE.Object3D
  region: AnchorRegion
  /** 0 at the little finger, 1 at the thumb — used to order the wash */
  across: number
  /** which hand it belongs to; contamination on a hand that is out of shot
   *  must not keep rendering */
  side?: 'left' | 'right'
}

interface FingerSpec {
  x: number
  y: number
  z: number
  length: number
  radius: number
  spread: number
  across: number
}

const PALM_W = 0.085
const PALM_H = 0.098
const PALM_D = 0.026

/** knuckle line sits at the top of the palm */
const KNUCKLE = PALM_H / 2 - 0.013

const FINGERS: FingerSpec[] = [
  { x: -0.031, y: KNUCKLE - 0.006, z: 0, length: 0.062, radius: 0.0072, spread: -0.15, across: 0 },
  { x: -0.011, y: KNUCKLE, z: 0, length: 0.077, radius: 0.008, spread: -0.05, across: 0.25 },
  { x: 0.0095, y: KNUCKLE + 0.001, z: 0, length: 0.082, radius: 0.0084, spread: 0.03, across: 0.5 },
  { x: 0.03, y: KNUCKLE - 0.003, z: 0, length: 0.073, radius: 0.008, spread: 0.11, across: 0.75 },
]

const SEG = [0.42, 0.32, 0.26]
const CURL = [0.9, 1.15, 0.95]

/**
 * One finger segment, plus a nail on the distal one.
 *
 * The lathe already carries the taper and the mid-shaft swell, so the only
 * thing applied here is a Z squash — fingers are noticeably wider across than
 * they are deep, and a perfectly round cross-section is a large part of what
 * made the first version read as sausages.
 */
function Phalanx({
  length,
  rBase,
  rTip,
  nail = false,
}: {
  length: number
  rBase: number
  rTip: number
  nail?: boolean
}) {
  const geo = useMemo(() => phalanxGeometry(length, rBase, rTip), [length, rBase, rTip])
  return (
    <group>
      <mesh geometry={geo} material={M.skin} castShadow receiveShadow scale={[1, 1, 0.84]} />
      {nail && (
        <mesh
          geometry={G.sphere}
          material={M.nail}
          // sits on the back of the segment, just short of the tip
          position={[0, length * 0.66, -rTip * 0.62]}
          rotation={[0.22, 0, 0]}
          scale={[rTip * 0.66, length * 0.24, rTip * 0.34]}
        />
      )}
    </group>
  )
}

function Finger({
  spec,
  curl,
  anchors,
  register,
}: {
  spec: FingerSpec
  curl: React.MutableRefObject<number>
  anchors: React.MutableRefObject<HandAnchor[]>
  register: (apply: () => void) => void
}) {
  const j0 = useRef<THREE.Group>(null)
  const j1 = useRef<THREE.Group>(null)
  const j2 = useRef<THREE.Group>(null)
  const tip = useRef<THREE.Object3D>(null)
  const nail = useRef<THREE.Object3D>(null)

  useEffect(() => {
    const list = anchors.current
    if (tip.current) list.push({ node: tip.current, region: 'tip', across: spec.across })
    if (nail.current) list.push({ node: nail.current, region: 'nail', across: spec.across })
  }, [anchors, spec.across])

  /*
   * Curl is applied synchronously when the parent sets it, not from this
   * component's own useFrame.
   *
   * The touch solver needs the fingertip's world position for the CURRENT
   * frame. If the joints were written from a child useFrame they would still
   * hold the previous frame's pose when the parent measures them, and the
   * solver would chase a stale target. Doing it via a registered callback also
   * keeps the sequence deterministic under manual stepping.
   */
  useEffect(() => {
    register(() => {
      const c = curl.current
      if (j0.current) j0.current.rotation.x = -c * CURL[0] * 0.62
      if (j1.current) j1.current.rotation.x = -c * CURL[1] * 0.62
      if (j2.current) j2.current.rotation.x = -c * CURL[2] * 0.62
    })
  }, [register, curl])

  const L = spec.length
  return (
    <group position={[spec.x, spec.y, spec.z]} rotation={[0, 0, spec.spread]}>
      <group ref={j0}>
        <Phalanx length={L * SEG[0]} rBase={spec.radius} rTip={spec.radius * 0.88} />
        <group ref={j1} position={[0, L * SEG[0], 0]}>
          <Phalanx length={L * SEG[1]} rBase={spec.radius * 0.88} rTip={spec.radius * 0.79} />
          <group ref={j2} position={[0, L * SEG[1], 0]}>
            <Phalanx length={L * SEG[2]} rBase={spec.radius * 0.79} rTip={spec.radius * 0.62} nail />
            <object3D ref={tip} position={[0, L * SEG[2] * 0.86, spec.radius * 0.42]} />
            <object3D ref={nail} position={[0, L * SEG[2] * 0.66, -spec.radius * 0.5]} />
          </group>
        </group>
      </group>
    </group>
  )
}

export interface HandHandle {
  group: THREE.Group
  anchors: HandAnchor[]
  setCurl(v: number): void
  /** index 0 = little finger .. 3 = index finger */
  setFinger(i: number, v: number): void
  setThumb(v: number): void
}

export const Hand = forwardRef<HandHandle, { side: 'left' | 'right' }>(function Hand(
  { side },
  ref
) {
  const group = useRef<THREE.Group>(null)
  const anchors = useRef<HandAnchor[]>([])
  const curl = useRef(0.12)

  const thumbJ0 = useRef<THREE.Group>(null)
  const thumbJ1 = useRef<THREE.Group>(null)
  const fingerCurls = useRef(FINGERS.map(() => ({ current: 0.12 })))
  const applies = useRef<(() => void)[]>([])
  const register = useMemo(() => (fn: () => void) => applies.current.push(fn), [])
  const flush = () => applies.current.forEach((fn) => fn())

  /*
   * A rounded box, deliberately.
   *
   * A tapered rounded-trapezoid palm was tried — anatomically more correct,
   * narrower at the wrist — and looked materially worse: the extruded outline
   * produced hard facets and a picture-frame bevel that read as a plastic
   * plate. The softer box holds up better under the close lighting, so
   * correctness lost to what actually renders well.
   */
  const palmGeo = useMemo(
    () => roundedBoxGeometry(PALM_W, PALM_H, PALM_D, 0.032, 0.005),
    []
  )

  const palmAnchors = useRef<THREE.Object3D[]>([])
  const webAnchors = useRef<THREE.Object3D[]>([])
  const backAnchors = useRef<THREE.Object3D[]>([])
  const thumbTip = useRef<THREE.Object3D>(null)

  useEffect(() => {
    const list = anchors.current
    palmAnchors.current.forEach((n, i) =>
      list.push({ node: n, region: 'palm', across: 0.15 + (i / 5) * 0.7 })
    )
    webAnchors.current.forEach((n, i) =>
      list.push({ node: n, region: 'web', across: 0.2 + (i / 3) * 0.6 })
    )
    backAnchors.current.forEach((n, i) =>
      list.push({ node: n, region: 'back', across: 0.2 + (i / 3) * 0.6 })
    )
    if (thumbTip.current) list.push({ node: thumbTip.current, region: 'tip', across: 1 })
  }, [])

  useEffect(() => {
    if (!ref) return
    const handle: HandHandle = {
      group: group.current!,
      anchors: anchors.current,
      setCurl(v) {
        curl.current = v
        fingerCurls.current.forEach((c) => (c.current = v))
        flush()
      },
      setFinger(i, v) {
        const c = fingerCurls.current[i]
        if (c) c.current = v
        flush()
      },
      setThumb(v) {
        if (thumbJ0.current) thumbJ0.current.rotation.x = -v * 0.5
        if (thumbJ1.current) thumbJ1.current.rotation.x = -v * 0.7
      },
    }
    if (typeof ref === 'function') ref(handle)
    else ref.current = handle
  }, [ref])

  const mirror = side === 'left' ? -1 : 1

  return (
    <group ref={group} scale={[mirror, 1, 1]}>
      <mesh geometry={palmGeo} material={M.skin} castShadow receiveShadow />

      {/* heel of the hand */}
      <mesh
        geometry={G.sphere}
        material={M.skin}
        castShadow
        position={[0, -PALM_H / 2 + 0.006, 0.002]}
        scale={[PALM_W * 0.46, 0.017, PALM_D * 0.5]}
      />
      {/* Knuckles. Without these the fingers sprout from a flat edge, which is
          the other half of why the slab-and-sausages version read wrong. */}
      {FINGERS.map((f, i) => (
        <mesh
          key={`knuckle-${i}`}
          geometry={G.sphere}
          material={M.skin}
          castShadow
          position={[f.x, f.y - 0.004, 0.001]}
          scale={[f.radius * 1.18, f.radius * 1.25, PALM_D * 0.44]}
        />
      ))}

      {/* thenar mass under the thumb */}
      <mesh
        geometry={G.sphere}
        material={M.skin}
        position={[0.03, -0.012, 0.008]}
        scale={[0.016, 0.03, 0.009]}
      />

      {/* wrist and forearm, running out of frame so the hand is not severed */}
      <mesh
        geometry={G.phalanx}
        material={M.skin}
        castShadow
        position={[0, -PALM_H / 2 - 0.026, 0]}
        scale={[0.026, 0.022, 0.021]}
      />
      <mesh
        geometry={G.phalanx}
        material={M.skin}
        castShadow
        position={[0, -PALM_H / 2 - 0.15, 0]}
        scale={[0.036, 0.115, 0.031]}
      />

      {FINGERS.map((spec, i) => (
        <Finger key={i} spec={spec} curl={fingerCurls.current[i]} anchors={anchors} register={register} />
      ))}

      {/* thumb: two segments, rotated out of the palm plane */}
      <group position={[0.036, -0.026, 0.009]} rotation={[0.78, -0.22, -1.16]}>
        <group ref={thumbJ0}>
          <Phalanx length={0.034} rBase={0.0098} rTip={0.009} />
          <group ref={thumbJ1} position={[0, 0.034, 0]}>
            <Phalanx length={0.029} rBase={0.009} rTip={0.0072} nail />
            <object3D ref={thumbTip} position={[0, 0.026, 0.004]} />
          </group>
        </group>
      </group>

      {/* palm anchors — where a door handle presses */}
      {[
        [0, -0.01, 0.015],
        [-0.022, 0.012, 0.015],
        [0.02, 0.006, 0.015],
        [-0.006, 0.03, 0.014],
        [0.012, -0.032, 0.013],
        [-0.026, -0.026, 0.012],
      ].map((p, i) => (
        <object3D
          key={i}
          ref={(n) => {
            if (n) palmAnchors.current[i] = n
          }}
          position={p as [number, number, number]}
        />
      ))}

      {/* between the fingers */}
      {[
        [-0.021, KNUCKLE - 0.002, 0.006],
        [-0.001, KNUCKLE, 0.006],
        [0.02, KNUCKLE - 0.002, 0.006],
      ].map((p, i) => (
        <object3D
          key={i}
          ref={(n) => {
            if (n) webAnchors.current[i] = n
          }}
          position={p as [number, number, number]}
        />
      ))}

      {/* backs of the hands */}
      {[
        [-0.018, 0.01, -0.014],
        [0.014, 0.02, -0.014],
        [0, -0.014, -0.014],
      ].map((p, i) => (
        <object3D
          key={i}
          ref={(n) => {
            if (n) backAnchors.current[i] = n
          }}
          position={p as [number, number, number]}
        />
      ))}
    </group>
  )
})
