'use client'

import { forwardRef, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { M, PALETTE, roundedBoxGeometry } from './materials'
import { sceneState } from '@/lib/scene-state'

export const PHONE = { w: 1.55, h: 3.15, d: 0.17, r: 0.3 }
/** the screen rect the germ field populates, in phone-local space */
export const PHONE_FACE = { w: PHONE.w - 0.3, h: PHONE.h - 0.34, z: -PHONE.d / 2 - 0.012 }
/**
 * Where the fingertip lands — near the TOP of the screen, not the middle.
 *
 * With a rigid hand the palm follows wherever the fingertip is placed, so the
 * further down the screen the contact sits, the more of the handset ends up
 * inside the hand. Right at the top edge, the phone hangs below the fingers
 * instead. The screen half-height is 1.405, so this is within a few
 * millimetres of the glass edge.
 */
export const CONTACT: [number, number] = [0.12, 1.36]

/**
 * A used phone.
 *
 * The point of this object is that it looks ordinary and well kept — the story
 * only works if the phone is not visibly disgusting. The wear is carried
 * entirely in the roughness map: fingerprint arcs and palm smudges that are
 * invisible at wide framing and only resolve as the camera pushes in.
 */
function smudgeMap() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 1024
  const g = c.getContext('2d')!

  // base: very smooth glass
  g.fillStyle = '#1a1a1a'
  g.fillRect(0, 0, c.width, c.height)

  const rnd = (() => {
    let a = 0x9e3779b9
    return () => {
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  })()

  // thumb arcs, concentrated where a thumb actually sweeps
  g.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 26; i++) {
    const cx = 150 + rnd() * 240
    const cy = 420 + rnd() * 460
    const rad = 40 + rnd() * 120
    const grd = g.createRadialGradient(cx, cy, rad * 0.2, cx, cy, rad)
    const a = 0.05 + rnd() * 0.1
    grd.addColorStop(0, `rgba(190,190,190,${a})`)
    grd.addColorStop(1, 'rgba(190,190,190,0)')
    g.fillStyle = grd
    g.beginPath()
    g.ellipse(cx, cy, rad, rad * (0.5 + rnd() * 0.6), rnd() * Math.PI, 0, Math.PI * 2)
    g.fill()
  }

  // fine ridge detail inside a few of them, so it reads as skin not dust
  g.lineWidth = 1
  for (let i = 0; i < 14; i++) {
    const cx = 160 + rnd() * 220
    const cy = 460 + rnd() * 420
    g.strokeStyle = `rgba(210,210,210,${0.05 + rnd() * 0.06})`
    for (let k = 0; k < 7; k++) {
      g.beginPath()
      g.arc(cx, cy, 6 + k * 3.5, rnd() * 1.5, 1.6 + rnd() * 2.2)
      g.stroke()
    }
  }

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  return tex
}

export const Phone = forwardRef<THREE.Group>(function Phone(_, ref) {
  const ripple = useRef<THREE.Mesh>(null)
  const rippleMat = useRef<THREE.MeshBasicMaterial>(null)
  const wipe = useRef<THREE.Mesh>(null)

  const bodyGeo = useMemo(() => roundedBoxGeometry(PHONE.w, PHONE.h, PHONE.d, PHONE.r, 0.02), [])
  // Screen depth and bevel are sized so the glass sits flush inside the body
  // rather than protruding past its front face.
  const screenGeo = useMemo(
    () => roundedBoxGeometry(PHONE.w - 0.14, PHONE.h - 0.14, 0.02, PHONE.r - 0.04, 0.006),
    []
  )
  const camGeo = useMemo(() => roundedBoxGeometry(0.72, 0.72, 0.05, 0.22, 0.012), [])

  const smudge = useMemo(() => (typeof document !== 'undefined' ? smudgeMap() : null), [])

  const glass = useMemo(() => {
    const m = M.phoneGlass.clone()
    if (smudge) {
      m.roughnessMap = smudge
      m.roughness = 0.14
    }
    return m
  }, [smudge])

  useFrame(() => {
    /*
     * The wipe sheet sweeps down the screen and the contamination clears behind
     * its leading edge — see GermField, where each particle's removal threshold
     * is its position down the glass.
     *
     * It rides slightly proud of the surface and is a touch wider than the
     * screen, so no particle survives at the margins.
     */
    const w = sceneState.product.wipe
    if (wipe.current) {
      wipe.current.visible = w > 0.01 && w < 0.995
      if (wipe.current.visible) {
        const top = PHONE_FACE.h / 2
        wipe.current.position.set(0, top - w * (PHONE_FACE.h + 0.5), PHONE_FACE.z - 0.06)
        // a little lift and tilt at the ends, as a sheet held in fingers would
        wipe.current.rotation.z = Math.sin(w * Math.PI) * 0.06
      }
    }

    const c = sceneState.phone.contact
    if (ripple.current && rippleMat.current) {
      const on = c > 0.001
      ripple.current.visible = on
      if (on) {
        // A highlight that spreads from the contact point and settles. Not a
        // glowing ring — it reads as the sheen of skin oil moving on glass.
        const s = 0.06 + c * 0.42
        ripple.current.scale.set(s, s, 1)
        rippleMat.current.opacity = Math.sin(Math.min(c, 1) * Math.PI) * 0.16
      }
    }
  })

  return (
    <group ref={ref}>
      <mesh geometry={bodyGeo} material={M.phoneBody} castShadow receiveShadow />
      <mesh geometry={screenGeo} material={glass} position={[0, 0, -PHONE.d / 2 + 0.012]} />

      {/* camera module on the back */}
      <mesh geometry={camGeo} material={M.phoneBody} position={[-PHONE.w / 2 + 0.55, PHONE.h / 2 - 0.55, PHONE.d / 2 + 0.02]} />
      {[
        [-0.13, 0.13],
        [0.13, -0.13],
      ].map(([dx, dy], i) => (
        <mesh
          key={i}
          position={[-PHONE.w / 2 + 0.55 + dx, PHONE.h / 2 - 0.55 + dy, PHONE.d / 2 + 0.05]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.15, 0.15, 0.09, 32]} />
          <meshPhysicalMaterial color={0x141418} metalness={0.4} roughness={0.15} clearcoat={1} />
        </mesh>
      ))}

      {/* the Wipely sheet, sweeping the screen */}
      <mesh ref={wipe} visible={false} castShadow>
        <planeGeometry args={[PHONE.w + 0.22, 0.62]} />
        <meshPhysicalMaterial
          color={0xfcfdff}
          roughness={0.9}
          sheen={0.5}
          sheenRoughness={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* contact highlight, on the screen face */}
      <mesh ref={ripple} position={[CONTACT[0], CONTACT[1], PHONE_FACE.z - 0.004]} visible={false}>
        <circleGeometry args={[1, 40]} />
        <meshBasicMaterial
          ref={rippleMat}
          color={PALETTE.bg}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
})
