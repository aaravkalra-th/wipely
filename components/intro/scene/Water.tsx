'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sceneState } from '@/lib/scene-state'

/**
 * The tap stream and the soap lather.
 *
 * No fluid simulation. The stream is a single tapered cylinder with a small
 * vertex wobble and scrolling streak lines in the fragment shader, which is
 * enough to read as running water at this framing and costs one draw call.
 */

const vert = /* glsl */ `
  varying vec2 vUv;
  varying float vFade;
  uniform float uTime;
  uniform float uFlow;
  void main() {
    vUv = uv;
    vec3 p = position;
    // the stream narrows and wavers slightly as it falls
    float fall = 1.0 - uv.y;
    p.x += sin(uTime * 7.0 + fall * 9.0) * 0.006 * fall;
    p.z += cos(uTime * 6.2 + fall * 8.0) * 0.006 * fall;
    p.xz *= mix(1.0, 0.72, fall);
    vFade = uFlow;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const frag = /* glsl */ `
  varying vec2 vUv;
  varying float vFade;
  uniform float uTime;
  void main() {
    // vertical streaks scrolling downward at speed
    float streak = fract(vUv.y * 6.0 + uTime * 2.6);
    float lines = smoothstep(0.0, 0.45, streak) * smoothstep(1.0, 0.55, streak);
    // fade in at the spout, fade out before the basin
    float ends = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
    float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
    float a = (0.16 + lines * 0.2) * ends * edge * vFade;
    gl_FragColor = vec4(vec3(0.86, 0.92, 0.97), a);
  }
`

export function WaterStream({ position }: { position: [number, number, number] }) {
  const mat = useRef<THREE.ShaderMaterial>(null)
  const group = useRef<THREE.Group>(null)

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uFlow: { value: 0 } }),
    []
  )

  useFrame((_, dt) => {
    uniforms.uTime.value += dt
    uniforms.uFlow.value = sceneState.water.flow
    if (group.current) group.current.visible = sceneState.water.flow > 0.01
  })

  return (
    <group ref={group} position={position}>
      <mesh>
        {/* 14mm at the spout, tapering, falling 420mm into the basin */}
        <cylinderGeometry args={[0.007, 0.0055, 0.42, 18, 8, true]} />
        <shaderMaterial
          ref={mat}
          vertexShader={vert}
          fragmentShader={frag}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

/**
 * Lather: a small cluster of soft spheres that grows with `soap` and is carried
 * away as the wash completes. Same principle as the germ field — position is a
 * function of state, never integrated.
 */
export function Lather({ anchor }: { anchor: React.MutableRefObject<THREE.Object3D | null> }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const geo = useMemo(() => new THREE.SphereGeometry(1, 10, 8), [])
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.55,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    []
  )

  const seeds = useMemo(
    () =>
      // metres: a lather cluster roughly the size of two cupped hands
      Array.from({ length: 46 }, (_, i) => ({
        a: (i / 46) * Math.PI * 2,
        r: 0.012 + (((i * 37) % 100) / 100) * 0.03,
        y: ((((i * 53) % 100) / 100) - 0.5) * 0.05,
        s: 0.0035 + (((i * 29) % 100) / 100) * 0.006,
        ph: ((i * 71) % 100) / 100,
      })),
    []
  )

  useFrame(() => {
    const m = mesh.current
    const a = anchor.current
    if (!m) return
    const soap = sceneState.hands.soap
    if (soap < 0.01 || !a) {
      m.count = 0
      return
    }
    m.count = seeds.length
    a.updateWorldMatrix(true, false)
    const base = new THREE.Vector3().setFromMatrixPosition(a.matrixWorld)
    const t = performance.now() * 0.001

    seeds.forEach((s, i) => {
      const spin = s.a + t * 0.5 + sceneState.hands.rub * 1.2
      dummy.position.set(
        base.x + Math.cos(spin) * s.r,
        base.y + s.y * 0.6 - sceneState.germs.washed * s.ph * 0.06,
        base.z + Math.sin(spin) * s.r * 0.5
      )
      const live = soap * (1 - Math.max(0, sceneState.germs.washed - s.ph) * 1.6)
      dummy.scale.setScalar(Math.max(s.s * live, 0.0001))
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={mesh} args={[geo, mat, 46]} frustumCulled={false} />
}
