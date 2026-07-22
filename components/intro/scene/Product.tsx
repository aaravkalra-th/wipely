'use client'

import { forwardRef, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { M, PALETTE, roundedBoxGeometry } from './materials'
import { sceneState } from '@/lib/scene-state'

/**
 * Wipely, as revealed in the studio.
 *
 * Same proportions and construction as the preserved section: a back shell, a
 * stack of sheets, a front pocket with a scooped opening, and a fold-out stand
 * on the outer face. Nothing about the form, the mechanism or the interface is
 * invented here — it is the object that already existed, lit properly.
 *
 * The layering uses `PANEL` as the *true* rendered thickness including bevel,
 * which is what the original got wrong: it laid the parts out against a nominal
 * thickness that the extruder never actually produced.
 */

export const WAL = { w: 1.18, h: 1.74, corner: 0.17 }
/** rendered shell thickness, bevel included */
const PANEL = 0.028
const PAD = 0.1
const NSHEET = 5

function pocketShape(w: number, h: number, r: number, scoop: number) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.quadraticCurveTo(0, y + h - scoop, x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return new THREE.ShapeGeometry(s, 16)
}

function logoTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(256, 220, 10, 256, 256, 300)
  grd.addColorStop(0, '#ffffff')
  grd.addColorStop(1, '#e6e9ee')
  g.fillStyle = grd
  g.beginPath()
  g.arc(256, 256, 256, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(0,0,0,.10)'
  g.lineWidth = 10
  g.beginPath()
  g.arc(256, 256, 232, 0, Math.PI * 2)
  g.stroke()
  g.fillStyle = '#0a84ff'
  g.beginPath()
  g.arc(256, 205, 26, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#1d1d1f'
  g.font = '600 74px Inter, -apple-system, Segoe UI, Roboto, Arial'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('Wipely', 256, 300)
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 8
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export const Product = forwardRef<THREE.Group>(function Product(_, ref) {
  const backRef = useRef<THREE.Mesh>(null)
  const frontRef = useRef<THREE.Mesh>(null)
  const brandRef = useRef<THREE.Mesh>(null)
  const standRef = useRef<THREE.Group>(null)
  const sheetRefs = useRef<(THREE.Mesh | null)[]>([])
  const peelRef = useRef<THREE.Mesh>(null)
  const shellMat = useRef<THREE.MeshPhysicalMaterial>(null)

  const FP_H = WAL.h - 0.16

  const backGeo = useMemo(() => roundedBoxGeometry(WAL.w, WAL.h, PANEL, WAL.corner, 0.008), [])
  const frontGeo = useMemo(() => {
    const shape = pocketShape(WAL.w, FP_H, WAL.corner, 0.26)
    const b = 0.007
    const core = PANEL - b * 2
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: core,
      bevelEnabled: true,
      bevelThickness: b,
      bevelSize: b,
      bevelSegments: 2,
      steps: 1,
    })
    g.translate(0, 0, -core / 2)
    g.computeVertexNormals()
    return g
  }, [FP_H])
  const sheetGeo = useMemo(() => roundedRect(WAL.w - 0.22, FP_H + 0.06, WAL.corner * 0.7), [FP_H])
  const standGeo = useMemo(
    () => roundedBoxGeometry(WAL.w * 0.82, WAL.h * 0.34, 0.016, WAL.corner * 0.8, 0.005),
    []
  )
  const peelGeo = useMemo(() => new THREE.PlaneGeometry(WAL.w - 0.4, 1.05, 6, 26), [])
  const peelBase = useMemo(() => {
    const p = peelGeo.attributes.position
    const arr = new Float32Array(p.count * 3)
    for (let i = 0; i < p.count; i++) {
      arr[i * 3] = p.getX(i)
      arr[i * 3 + 1] = p.getY(i)
      arr[i * 3 + 2] = p.getZ(i)
    }
    return arr
  }, [peelGeo])

  const logo = useMemo(() => (typeof document !== 'undefined' ? logoTexture() : null), [])

  const MOUTH_Y = -0.02 + FP_H / 2 - 0.13

  useFrame(() => {
    const s = sceneState.product

    // Layer everything against the real thickness of the parts.
    const half = PAD / 2
    if (backRef.current) backRef.current.position.z = -half + PANEL / 2 - s.section * 0.22
    if (frontRef.current) frontRef.current.position.z = half - PANEL / 2 + s.section * 0.22

    // Sheets occupy the cavity between the two shells. The available span is
    // computed from the real panel thickness, and is clamped so it can never
    // invert on a thin variant the way the original did.
    const innerBack = -half + PANEL
    const innerFront = half - PANEL
    const span = Math.max(innerFront - innerBack, 0.004)
    const pad = Math.min(0.004, span * 0.2)
    for (let i = 0; i < NSHEET; i++) {
      const mesh = sheetRefs.current[i]
      if (!mesh) continue
      const f = NSHEET > 1 ? i / (NSHEET - 1) : 0
      mesh.position.set(
        0,
        -0.02 - f * 0.008,
        innerBack + pad + f * (span - pad * 2) + s.section * (f - 0.5) * 0.34
      )
    }

    // The brand mark sits proud of the front shell, and — unlike the original —
    // in front of the folded stand rather than buried inside it.
    if (brandRef.current) brandRef.current.position.z = half + 0.03 + s.section * 0.3

    if (standRef.current) {
      // seated just inside the front shell rather than stuck on top of it
      standRef.current.position.set(0, -WAL.h / 2 + 0.05, half - 0.012)
      standRef.current.rotation.x = 0
    }

    // Silhouette -> material. At light=0 the shell reads as a black cut-out;
    // the real colour arrives only once the edge light has established the form.
    if (shellMat.current) {
      const l = s.light
      shellMat.current.color
        .set(0x05070a)
        .lerp(new THREE.Color(PALETTE.padBlue), Math.max(0, (l - 0.25) / 0.75))
      shellMat.current.roughness = 0.62
    }

    // Demonstration peel: one sheet drawn out of the mouth, curling forward.
    const peel = s.peel
    if (peelRef.current) {
      peelRef.current.visible = peel > 0.02
      if (peelRef.current.visible) {
        const p = peelGeo.attributes.position
        const L = 1.05
        const len = L * (0.12 + peel * 0.88)
        const k = 2.35 / L
        for (let i = 0; i < p.count; i++) {
          const bx = peelBase[i * 3]
          const by = peelBase[i * 3 + 1]
          const t = (by + L / 2) / L
          const a = k * t * len
          p.setXYZ(i, bx * (1 - 0.05 * t), Math.sin(a) / k, (1 - Math.cos(a)) / k)
        }
        p.needsUpdate = true
        peelGeo.computeVertexNormals()
        peelRef.current.position.set(0, MOUTH_Y, half + 0.006)
      }
    }
  })

  return (
    <group ref={ref}>
      <mesh ref={backRef} geometry={backGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          ref={shellMat}
          color={PALETTE.padBlue}
          roughness={0.62}
          sheen={0.6}
          sheenRoughness={0.5}
          sheenColor={new THREE.Color(0xdbe6ff)}
          clearcoat={0.15}
          clearcoatRoughness={0.5}
        />
      </mesh>

      {Array.from({ length: NSHEET }, (_, i) => (
        <mesh
          key={i}
          ref={(n) => {
            sheetRefs.current[i] = n
          }}
          geometry={sheetGeo}
          material={M.sheet}
        />
      ))}

      <mesh
        ref={frontRef}
        geometry={frontGeo}
        material={M.pad}
        position={[0, -0.02, 0]}
        castShadow
        receiveShadow
      />

      <mesh ref={peelRef} geometry={peelGeo} material={M.sheet} castShadow visible={false} />

      {logo && (
        <mesh ref={brandRef} position={[0, -0.56, 0]}>
          <circleGeometry args={[0.115, 48]} />
          <meshStandardMaterial map={logo} transparent roughness={0.6} />
        </mesh>
      )}

      {/* fold-out stand, seated flush on the outer face */}
      <group ref={standRef}>
        <mesh
          geometry={standGeo}
          material={M.pad}
          position={[0, (WAL.h * 0.34) / 2, 0]}
          castShadow
        />
      </group>
    </group>
  )
})
