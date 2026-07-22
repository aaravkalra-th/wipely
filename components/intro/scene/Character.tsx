'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { sceneState } from '@/lib/scene-state'

/**
 * The person who comes home.
 *
 * Asset: Quaternius "Animated Men Pack", CC0 / public domain, via Poly Pizza.
 * See ASSETS.md for provenance. It is a stylised low-poly character with flat
 * vertex colours and no textures — 493 KB for a full rig and eleven clips.
 *
 * It is deliberately staged as a near-silhouette in the lit doorway. At that
 * framing you read gait, posture and weight rather than surface, which is what
 * this asset is good at and what the shot needs. Pushed closer it would not
 * hold up, so the timeline never does.
 *
 * Two things are handled here rather than in the timeline:
 *
 * 1. SCALE NORMALISATION. The exporter baked a scale into the armature node, so
 *    the raw mesh bounds are meaningless. The rig is measured on load and scaled
 *    to a real 1.75 m, with the feet planted on y=0. Everything else in this
 *    scene is life size and the character has to agree.
 *
 * 2. WALK REFINEMENT. The brief is explicit that a stock loop is not acceptable.
 *    What is done here: the clip is retimed and its travel speed matched to the
 *    stride so the feet do not skate, the playback head is driven from timeline
 *    seconds so it scrubs with everything else, and the torso carries a small
 *    forward lean.
 *
 *    Being straight about the limits: this is a light refinement, not a
 *    reanimation. The gait itself is still Quaternius's. Damping the arm swing
 *    was attempted and removed — see the note in the refinement pass below.
 *    Properly reworking the walk means editing the clip in Blender, not
 *    correcting bones at runtime.
 */

const MODEL = '/models/person.glb'
const TARGET_HEIGHT = 1.75
const WALK_CLIP = 'HumanArmature|Man_Walk'

/** forward lean at the abdomen, radians */
const LEAN = 0.07

export function Character() {
  const { scene, animations } = useGLTF(MODEL)
  const root = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)

  // useGLTF caches by URL, so the rig is cloned rather than mounted directly.
  // It must be SkeletonUtils.clone: plain Object3D.clone() copies the bones and
  // the mesh but leaves the new mesh bound to the *original* skeleton, which
  // leaves the copy unskinned and its bounds unmeasurable.
  const model = useMemo(() => {
    const clone = cloneSkinned(scene)
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
        o.frustumCulled = false
      }
    })
    return clone
  }, [scene])

  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model])

  /** bones we correct after the mixer has written the stock pose */
  const rig = useRef<{
    armL?: THREE.Object3D
    armR?: THREE.Object3D
    abdomen?: THREE.Object3D
    restArmL?: THREE.Quaternion
    restArmR?: THREE.Quaternion
    restAbdomen?: THREE.Quaternion
  }>({})

  /**
   * Look a node up by name, tolerating the loader's renaming.
   *
   * glTF node names are sanitised on import — three strips characters that are
   * illegal in property-binding paths, so the rig's `Foot.L_end` arrives as
   * `FootL_end`. Looking up the authored name finds nothing, silently, which is
   * exactly the kind of failure that leaves a character sitting at native scale
   * with no error anywhere.
   */
  const findNode = useMemo(
    () => (name: string) =>
      model.getObjectByName(name) ?? model.getObjectByName(name.replace(/\./g, '')),
    [model]
  )

  useEffect(() => {
    const clip = animations.find((a) => a.name === WALK_CLIP) ?? animations[0]
    if (clip) {
      const action = mixer.clipAction(clip)
      action.loop = THREE.LoopRepeat
      action.play()
    }

    // Scale normalisation happens lazily in useFrame — see calibrate(). It
    // cannot be done here because the rig has not been posed yet.

    rig.current = {
      armL: findNode('UpperArm.L'),
      armR: findNode('UpperArm.R'),
      abdomen: findNode('Abdomen'),
    }
    // Capture the bind pose before the mixer starts overwriting it.
    rig.current.restArmL = rig.current.armL?.quaternion.clone()
    rig.current.restArmR = rig.current.armR?.quaternion.clone()
    rig.current.restAbdomen = rig.current.abdomen?.quaternion.clone()

    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(model)
    }
  }, [animations, mixer, model, findNode])

  const leanQ = useMemo(() => new THREE.Quaternion(), [])
  const leanEuler = useMemo(() => new THREE.Euler(), [])
  const calibrated = useRef(false)
  const tmp = useMemo(() => new THREE.Vector3(), [])

  /**
   * Measure the rig and scale it to life size.
   *
   * This deliberately measures the SKELETON, not the geometry. This asset's
   * bind-pose bounding box is 0.007 units tall and bears no relation to what
   * actually gets drawn — the exporter left the mesh in a compressed bind space
   * and relies entirely on the skin matrices — so Box3.setFromObject returns a
   * number that is confidently wrong. Bone world positions reflect the real
   * posed figure, and this rig helpfully carries `Head_end` and `Foot.*_end`
   * tips, which is exactly a standing height.
   *
   * Runs once, on the first frame after the mixer has posed the rig.
   */
  const calibrate = () => {
    const g = inner.current
    if (!g) return
    const head = findNode('Head_end')
    const footL = findNode('Foot.L_end')
    const footR = findNode('Foot.R_end')
    if (!head || !(footL || footR)) {
      console.error('[Character] rig landmarks not found; cannot scale to life size')
      calibrated.current = true
      if (inner.current) inner.current.visible = false
      return
    }

    model.updateWorldMatrix(true, true)
    const headY = tmp.setFromMatrixPosition(head.matrixWorld).y
    let footY = Infinity
    for (const f of [footL, footR]) {
      if (f) footY = Math.min(footY, tmp.setFromMatrixPosition(f.matrixWorld).y)
    }

    const h = headY - footY
    if (!Number.isFinite(h) || h < 1e-5) {
      console.error('[Character] rig measured as', h, '— leaving hidden')
      g.visible = false
      return
    }

    const s = (TARGET_HEIGHT / h) * g.scale.x
    if (process.env.NODE_ENV !== 'production') {
      console.info('[Character] measured foot-to-head', h.toFixed(3), '-> scale', s.toFixed(3))
    }
    g.scale.setScalar(s)
    // Re-measure the foot after scaling and plant it on the floor.
    model.updateWorldMatrix(true, true)
    let planted = Infinity
    for (const f of [footL, footR]) {
      if (f) planted = Math.min(planted, tmp.setFromMatrixPosition(f.matrixWorld).y)
    }
    g.position.y -= planted - (root.current?.position.y ?? 0)
    g.visible = true
    calibrated.current = true
  }

  useFrame(() => {
    const p = sceneState.person
    const g = root.current
    if (!g) return

    g.visible = p.present > 0.01
    if (!g.visible) return

    g.position.set(p.px, p.py, p.pz)
    g.rotation.set(p.rx, p.ry, p.rz)

    // The clip is driven from timeline seconds rather than wall clock, so the
    // walk scrubs and skips with everything else instead of running free.
    mixer.setTime(Math.max(p.walk, 0))

    // Scale is derived once, from the posed skeleton.
    if (!calibrated.current) calibrate()

    /*
     * Refinement pass, applied on top of the stock pose.
     *
     * Every correction here must be ABSOLUTE — derived from the captured rest
     * pose — never relative to the current value. A relative `multiply` looks
     * correct for one frame and then compounds on every subsequent frame,
     * because the walk clip carries no track for the abdomen and so nothing
     * ever resets it. That winds the torso further round each frame until the
     * rig tears itself apart.
     */
    const r = rig.current

    /*
     * NOTE: an earlier version damped the arm swing by blending the animated
     * arm rotation toward the captured rest pose. That was wrong. The rest pose
     * on this rig is the BIND pose, which is a T-pose — blending toward it does
     * not reduce the swing, it raises the arms out to the sides and stretches
     * the shoulder geometry. Damping the swing properly needs a neutral
     * reference sampled from the clip itself, which is not worth the complexity
     * here; the retimed playback and the lean carry the refinement instead.
     */

    // Lean: set from rest, not accumulated onto the live value.
    if (r.abdomen && r.restAbdomen) {
      leanEuler.set(LEAN, 0, 0)
      leanQ.setFromEuler(leanEuler)
      r.abdomen.quaternion.copy(r.restAbdomen).multiply(leanQ)
    }
  })

  return (
    <group ref={root} name="person" visible={false}>
      <group ref={inner}>
        <primitive object={model} />
      </group>
    </group>
  )
}

useGLTF.preload(MODEL)
