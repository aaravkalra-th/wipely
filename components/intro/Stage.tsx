'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, advance, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { Room, DoorwayLight } from './scene/Room'
import { Character } from './scene/Character'
import type { HandAnchor } from './scene/Hand'
import { HandMesh } from './scene/HandMesh'
import { Phone, PHONE_FACE, CONTACT } from './scene/Phone'
import { Product } from './scene/Product'
import { GermField } from './scene/GermField'
import { WaterStream, Lather } from './scene/Water'
import { M, PALETTE, disposeShared } from './scene/materials'
import { sceneState } from '@/lib/scene-state'
import { deg, PARALLAX_MAX_DEG } from '@/lib/motion'

/** world position the tracked particle flies to, at the product */
const TRACER_TARGET: [number, number, number] = [0, 1.35, 0.6]

function CameraRig() {
  const { camera } = useThree()
  const target = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const c = sceneState.cam
    const cam = camera as THREE.PerspectiveCamera

    cam.position.set(c.px, c.py, c.pz)
    target.set(c.tx, c.ty, c.tz)
    cam.lookAt(target)

    // Pointer parallax, applied after lookAt and hard-capped at two degrees.
    cam.rotateY(deg(sceneState.parallax.x * PARALLAX_MAX_DEG))
    cam.rotateX(deg(sceneState.parallax.y * PARALLAX_MAX_DEG))

    if (cam.fov !== c.fov) {
      cam.fov = c.fov
      cam.updateProjectionMatrix()
    }
  })
  return null
}

/**
 * Two lighting worlds that crossfade rather than cut.
 *
 * Domestic: warm key from the side, cool daylight through the doorway.
 * Studio:   soft top light plus a narrow raking edge light used to establish
 *           the product's silhouette before its material arrives.
 */
function Lighting() {
  const warmKey = useRef<THREE.DirectionalLight>(null)
  const warmFill = useRef<THREE.HemisphereLight>(null)
  const studioKey = useRef<THREE.DirectionalLight>(null)
  const studioFill = useRef<THREE.DirectionalLight>(null)
  const edge = useRef<THREE.SpotLight>(null)
  const { gl } = useThree()

  useFrame(() => {
    const s = sceneState
    const studio = s.cam.studio
    const domestic = 1 - studio
    const dim = 1 - s.env.isolate * 0.82

    if (warmKey.current) warmKey.current.intensity = 2.5 * domestic * dim
    if (warmFill.current) warmFill.current.intensity = 0.42 * domestic * dim
    if (studioKey.current) studioKey.current.intensity = 2.9 * studio
    if (studioFill.current) studioFill.current.intensity = 1.0 * studio

    // The edge light peaks early in the reveal and settles back once the
    // material is readable — it establishes form, it does not stay as a glow.
    const l = s.product.light
    if (edge.current) {
      edge.current.intensity = 26 * Math.sin(Math.min(l, 1) * Math.PI * 0.85) * studio
    }

    gl.toneMappingExposure = 0.82 * s.env.exposure
  })

  return (
    <>
      <directionalLight
        ref={warmKey}
        position={[3.4, 3.6, 1.6]}
        // Only lightly warm. A saturated key turns every neutral surface in the
        // room into the same wash of beige.
        color={0xfff0dd}
        intensity={0}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={18}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-bias={-0.0004}
      />
      {/* Cool sky against the warm key: the contrast between the two is what
          stops the interior reading as monochrome. */}
      <hemisphereLight ref={warmFill} args={[0xcfdcf0, 0x6b5b4a, 0]} />
      <DoorwayLight />

      <directionalLight
        ref={studioKey}
        position={[1.6, 4.2, 3.2]}
        color={0xffffff}
        intensity={0}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={16}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-bias={-0.0003}
      />
      <directionalLight ref={studioFill} position={[-3, 1.6, 2]} color={0xdfe6f2} intensity={0} />
      <spotLight
        ref={edge}
        position={[-2.4, 1.9, -1.5]}
        target-position={[0, 1.25, 0]}
        angle={0.5}
        penumbra={0.9}
        color={0xffffff}
        intensity={0}
        distance={9}
      />
    </>
  )
}

/**
 * The studio floor.
 *
 * A shadow-catcher rather than a lit surface: a shaded plane meeting the
 * background colour draws a hard horizon line straight across the frame, which
 * is exactly what a real product sweep is built to avoid. This way the only
 * thing that appears is the contact shadow, and the product sits in an
 * unbounded field — the same treatment the preserved section uses.
 */
function StudioGround() {
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.ShadowMaterial>(null)
  useFrame(() => {
    const studio = sceneState.cam.studio
    if (mesh.current) mesh.current.visible = studio > 0.01
    if (mat.current) mat.current.opacity = 0.11 * studio
  })
  return (
    <mesh
      ref={mesh}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.98, 0]}
      receiveShadow
      visible={false}
    >
      <planeGeometry args={[40, 40]} />
      <shadowMaterial ref={mat} transparent opacity={0} />
    </mesh>
  )
}

/**
 * A scrim used only in scene 2, when the background is suppressed so the
 * contamination on the hands is legible. It is a plane behind the hands, not a
 * post-process — cheaper, and it keeps the hands fully lit.
 */
function IsolationScrim() {
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(() => {
    const v = sceneState.env.isolate
    if (mesh.current) {
      mesh.current.visible = v > 0.01
      // parked just behind the hands, facing the camera
      mesh.current.position.set(
        sceneState.hands.px,
        sceneState.hands.py,
        sceneState.hands.pz - 0.9
      )
      mesh.current.lookAt(sceneState.cam.px, sceneState.cam.py, sceneState.cam.pz)
    }
    if (mat.current) mat.current.opacity = v * 0.93
  })
  return (
    <mesh ref={mesh} visible={false}>
      <planeGeometry args={[14, 10]} />
      <meshBasicMaterial ref={mat} color={0x14161a} transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

function Hands({
  anchors,
  soapAnchor,
  groupRef,
  phoneRef,
}: {
  anchors: React.MutableRefObject<HandAnchor[]>
  soapAnchor: React.MutableRefObject<THREE.Object3D | null>
  groupRef: React.MutableRefObject<THREE.Group | null>
  phoneRef: React.MutableRefObject<THREE.Group | null>
}) {
  // Pulled ~3mm off the glass along the screen normal: the fingertip anchor sits
  // inside the finger volume, so solving it exactly onto the surface buries the
  // pad in the screen. This lands the finger ON the glass rather than through it.
  const contactLocal = useMemo(
    () => new THREE.Vector3(CONTACT[0], CONTACT[1], PHONE_FACE.z - 0.075),
    []
  )
  const contactWorld = useMemo(() => new THREE.Vector3(), [])
  const tipWorld = useMemo(() => new THREE.Vector3(), [])
  const group = groupRef
  const lg = useRef<THREE.Group>(null)
  const rg = useRef<THREE.Group>(null)

  // Each hand mesh samples its own anchors off its vertices and publishes them.
  const leftAnchors = useRef<HandAnchor[]>([])
  const rightAnchors = useRef<HandAnchor[]>([])
  const merge = useCallback(() => {
    anchors.current = [...leftAnchors.current, ...rightAnchors.current]
  }, [anchors])
  const takeLeft = useCallback(
    (a: HandAnchor[]) => {
      leftAnchors.current = a
      merge()
    },
    [merge]
  )
  const takeRight = useCallback(
    (a: HandAnchor[]) => {
      rightAnchors.current = a
      merge()
    },
    [merge]
  )

  useFrame(() => {
    const h = sceneState.hands
    const g = group.current
    if (!g) return

    g.visible = h.present > 0.01
    g.position.set(h.px, h.py, h.pz)
    g.rotation.set(h.rx, h.ry, h.rz)

    // The rub is a counter-phase slide of the two hands across each other.
    // Amplitudes are in metres: a 20mm slide, a 6mm lift.
    const phase = h.rub * Math.PI * 2
    const slide = Math.sin(phase) * 0.02 * h.rubAmt
    const lift = Math.cos(phase * 2) * 0.006 * h.rubAmt

    // Scene 1 is a single hand entering the foreground; the second only arrives
    // once we are in close-up on both. When solo, the right hand sits on the
    // group origin so the timeline can frame it directly.
    const solo = h.solo > 0.5
    const spread = solo ? 0 : h.apart

    /*
     * During the scrub the hands turn palms-toward-each-other. Held flat and
     * palms-out they read as someone presenting their hands, not washing them —
     * and since the mesh is rigid there is no finger interlace available to sell
     * it, so the turn has to carry it.
     */
    /*
     * Palms turn to FACE EACH OTHER during the scrub.
     *
     * Both hands' palms face +Z at rest. To bring the right hand's palm round
     * to -X (toward its partner) it rotates -90 degrees about Y, and the left
     * hand +90. An earlier version had these two signs the wrong way round,
     * which turned the hands away from each other — and raising the angle only
     * made that worse, which is why it looked wrong rather than merely weak.
     */
    const inward = 1.42 * h.rubAmt

    if (lg.current) {
      lg.current.visible = !solo
      lg.current.position.set(-spread / 2 + slide, lift, 0.012 * h.rubAmt)
      lg.current.rotation.set(0, inward, 0.1 + slide * 2.5)
    }
    if (rg.current) {
      rg.current.position.set(spread / 2 - slide, -lift, -0.012 * h.rubAmt)
      rg.current.rotation.set(0, -inward, -0.1 - slide * 2.5)
    }

    /*
     * The hand mesh is rigid — see HandMesh for why it cannot be rigged from
     * its own geometry. `curl` and `reach` therefore drive whole-hand attitude
     * rather than fingers: closing tips the hand forward as a fist would, and
     * reaching rolls it toward the target.
     */
    if (rg.current) rg.current.rotation.x = -h.curl * 0.34 - h.reach * 0.16
    if (lg.current) lg.current.rotation.x = -h.curl * 0.34

    // Wet skin: lower roughness, a little clearcoat. Shared material, so it is
    // set once per frame rather than per mesh.
    M.skin.roughness = 0.58 - h.wet * 0.34
    M.skin.clearcoat = h.wet * 0.55

    /*
     * Land the fingertip on the glass.
     *
     * Hand-authored positions get within a centimetre, and a centimetre at
     * macro framing is the difference between touching the screen and hovering
     * over it. So the last step is solved rather than tuned: measure where the
     * right index fingertip actually ended up, measure where the contact point
     * actually is, and translate the whole hand by the difference.
     *
     * This is deliberately inline rather than a separate component with a
     * useFrame priority — any priority above zero switches R3F to manual
     * rendering and the canvas stops drawing itself.
     */
    const lock = h.touchLock
    const phone = phoneRef.current
    if (lock > 0.001 && phone) {
      /*
       * Pick the right hand's fingertip that is ALREADY NEAREST the contact
       * point, rather than naming a specific finger.
       *
       * The previous version matched `across === 0.75` — an exact float compare
       * that worked only because the old procedural rig hardcoded that value.
       * The mesh computes `across` continuously, so the lookup silently found
       * nothing and the solver quietly did nothing at all. Choosing by distance
       * cannot fail that way, and it also picks whichever finger is genuinely
       * closest, which is what should be touching.
       */
      g.updateWorldMatrix(true, true)
      phone.updateWorldMatrix(true, false)
      contactWorld.copy(contactLocal).applyMatrix4(phone.matrixWorld)

      let tip: THREE.Object3D | null = null
      let best = Infinity
      for (const a of anchors.current) {
        if (a.side !== 'right' || a.region !== 'tip') continue
        a.node.updateWorldMatrix(true, false)
        tipWorld.setFromMatrixPosition(a.node.matrixWorld)
        const d = tipWorld.distanceToSquared(contactWorld)
        if (d < best) {
          best = d
          tip = a.node
        }
      }

      if (tip) {
        tipWorld.setFromMatrixPosition(tip.matrixWorld)
        g.position.addScaledVector(contactWorld.sub(tipWorld), lock)
      } else if (process.env.NODE_ENV !== 'production') {
        console.warn('[Hands] no right-hand fingertip anchor; touch cannot be solved')
      }
    }
  })

  return (
    <group ref={group} visible={false}>
      <group ref={lg} name="handL">
        <HandMesh side="left" onAnchors={takeLeft} />
      </group>
      <group ref={rg} name="handR">
        <HandMesh side="right" onAnchors={takeRight} />
      </group>
      <object3D ref={soapAnchor} position={[0, 0, 0.02]} />
    </group>
  )
}

function Scene({ anchors }: { anchors: React.MutableRefObject<HandAnchor[]> }) {
  const phoneRef = useRef<THREE.Group>(null)
  const productRef = useRef<THREE.Group>(null)
  const roomRef = useRef<THREE.Group>(null)
  // Lives on the hands, but the lather itself is rendered at the scene root:
  // it writes world-space instance matrices, so parenting it under the hands
  // would apply the hand transform to them a second time.
  const soapAnchor = useRef<THREE.Object3D | null>(null)
  const handsGroup = useRef<THREE.Group | null>(null)

  useFrame(() => {
    const s = sceneState

    if (phoneRef.current) {
      const p = s.phone
      phoneRef.current.visible = p.present > 0.01
      phoneRef.current.position.set(p.px, p.py, p.pz)
      phoneRef.current.rotation.set(p.rx, p.ry, p.rz)
      // The phone model is authored 1.55 units wide; a real handset is 71mm.
      phoneRef.current.scale.setScalar(0.046)
    }

    if (productRef.current) {
      const p = s.product
      productRef.current.visible = p.reveal > 0.01
      productRef.current.position.set(p.px, p.py, p.pz)
      productRef.current.rotation.set(p.rx, p.ry, p.rz)
      // Pad is authored 1.18 units wide; the real product is ~62mm.
      productRef.current.scale.setScalar(0.053)
    }

    // The domestic set is dismissed once the studio has taken over, so it stops
    // costing draw calls during the reveal.
    if (roomRef.current) roomRef.current.visible = s.cam.studio < 0.985
  })

  return (
    <>
      <Lighting />
      <StudioGround />
      <group ref={roomRef}>
        <Room />
      </group>
      <IsolationScrim />
      <Character />
      <Hands
        anchors={anchors}
        soapAnchor={soapAnchor}
        groupRef={handsGroup}
        phoneRef={phoneRef as React.MutableRefObject<THREE.Group | null>}
      />
      <Lather anchor={soapAnchor} />
      <group ref={phoneRef} visible={false}>
        <Phone />
      </group>
      <group ref={productRef} visible={false}>
        <Product />
      </group>
      <GermField
        handAnchors={anchors}
        phoneRef={phoneRef as React.MutableRefObject<THREE.Object3D | null>}
        phoneFace={PHONE_FACE}
        contactPoint={CONTACT}
        tracerTarget={TRACER_TARGET}
      />
      {/* directly under the spout outlet, falling into the bowl */}
      <WaterStream position={[-2.15, 1.19, -1.13]} />
    </>
  )
}

/** Frees every shared geometry and material when the introduction unmounts. */
function DisposeOnUnmount() {
  const { gl } = useThree()
  useEffect(
    () => () => {
      disposeShared()
      gl.renderLists.dispose()
    },
    [gl]
  )
  return null
}

export function Stage() {
  const anchors = useRef<HandAnchor[]>([])
  const [running, setRunning] = useState(true)

  // Pause the render loop entirely while the tab is hidden.
  useEffect(() => {
    const onVis = () => setRunning(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Pointer parallax, normalised to -1..1 and fed to the camera rig.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      sceneState.parallax.x = (e.clientX / window.innerWidth) * 2 - 1
      sceneState.parallax.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  return (
    <Canvas
      frameloop={running ? 'always' : 'never'}
      // Capped so high-density displays do not render four times the pixels.
      dpr={[1, 1.75]}
      shadows
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      // Near plane is tight because scenes 4 and 6 are macro shots taken from
      // around 200mm away.
      camera={{ fov: 40, near: 0.02, far: 60, position: [0.55, 1.15, 0.9] }}
      onCreated={({ gl, scene, camera }) => {
        if (process.env.NODE_ENV !== 'production') {
          // Dev-only: step the whole sequence to an exact time and render one
          // frame. Lets the timeline be inspected beat by beat without waiting
          // on wall-clock playback.
          Object.assign(window, {
            __scene: scene,
            __cam: camera,
            /** render one frame against whatever sceneState currently holds */
            __advance: () => advance(performance.now()),
            /** world AABB of a named object, or null */
            __box: (name: string) => {
              const o = scene.getObjectByName(name)
              if (!o || !o.visible) return null
              const b = new THREE.Box3().setFromObject(o)
              if (b.isEmpty()) return null
              return { min: b.min.toArray(), max: b.max.toArray() }
            },
            __step: (t: number) => {
              const tl = (window as unknown as { __tl?: gsap.core.Timeline }).__tl
              tl?.pause().seek(t)
              advance(performance.now())
            },
            /*
             * Dev-only collision report.
             *
             * Added because tuning 3D placement by eye off single screenshots
             * kept producing things that looked fine in one frame and
             * intersected in the next. This measures the actual world boxes.
             */
            __diag: (t: number) => {
              const w = window as unknown as { __step: (n: number) => void }
              w.__step(t)
              const box = (name: string) => {
                const o = scene.getObjectByName(name)
                if (!o || !o.visible) return null
                const b = new THREE.Box3().setFromObject(o)
                return b.isEmpty() ? null : b
              }
              const fmt = (b: THREE.Box3 | null) =>
                b
                  ? {
                      min: b.min.toArray().map((v) => +v.toFixed(3)),
                      max: b.max.toArray().map((v) => +v.toFixed(3)),
                      size: b.getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(3)),
                    }
                  : null
              const person = box('person')
              const door = box('door')
              const solids = ['wallL', 'wallR', 'wallTop', 'jambL', 'jambR']
              const hl = box('handL')
              const hr = box('handR')
              const overlap = (a: THREE.Box3 | null, b: THREE.Box3 | null) => {
                if (!a || !b || !a.intersectsBox(b)) return null
                const i = a.clone().intersect(b)
                return i.getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(3))
              }
              return {
                t,
                person: fmt(person),
                door: fmt(door),
                handL: fmt(hl),
                handR: fmt(hr),
                personVsDoor: overlap(person, door),
                // each solid tested separately — see the note in Room.tsx
                personVsSolids: solids
                  .map((n) => ({ n, o: overlap(person, box(n)) }))
                  .filter((r) => r.o),
                handVsHand: overlap(hl, hr),
              }
            },
          })
        }
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 0.82
        gl.shadowMap.type = THREE.PCFSoftShadowMap
        scene.background = new THREE.Color(PALETTE.bg)

        // A generated room probe, so the physical materials have something to
        // reflect. Without it the chrome and the product shell are flat.
        const pmrem = new THREE.PMREMGenerator(gl)
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
        // Held well down: the probe is here for specular response on the chrome
        // and the product shell, not to act as a second fill light.
        scene.environmentIntensity = 0.28
        pmrem.dispose()
      }}
    >
      <CameraRig />
      <Scene anchors={anchors} />
      <DisposeOnUnmount />
    </Canvas>
  )
}
