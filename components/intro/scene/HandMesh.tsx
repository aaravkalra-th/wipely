'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { M } from './materials'
import type { HandAnchor, AnchorRegion } from './Hand'

/**
 * The hand.
 *
 * Asset: "Low Poly Hand" by ronildo.facanha, via Sketchfab.
 * **CC-BY 4.0 — attribution is a licence condition, not a courtesy.**
 *
 * Three facts about this file drive everything below.
 *
 * 1. IT SHIPS FOUR IDENTICAL COPIES. Four meshes, each 512 verts / 786 tris,
 *    byte-identical bounds, stacked coincident. Rendering all four is four
 *    times the draw calls plus z-fighting on every shared face. Only the first
 *    is kept — which is also why the source's "3.1k triangles" is really 786.
 *
 * 2. IT IS NOT RIGGED. No skins, no joints, no clips.
 *
 * 3. IT CANNOT BE AUTO-RIGGED FROM ITS GEOMETRY. The obvious fallback — cluster
 *    the vertices into five fingers and bend each — does not survive contact
 *    with the data. The distal region holds 56 vertices across five fingers and
 *    no clustering threshold separates them: at 2 units they fragment into
 *    vertex pairs, at 6 they merge into two blobs. Adjacent finger surfaces sit
 *    closer together than consecutive vertices within one finger, so there is
 *    no way to tell that a vertex belongs to the index rather than the middle
 *    finger. Any curl would tear the mesh.
 *
 * The hand is therefore rigid, and articulation is carried by whole-hand motion
 * instead. To get real finger curl the mesh needs bones added in Blender — see
 * ASSETS.md.
 *
 * Germ anchors are sampled from ACTUAL MESH VERTICES rather than hand-authored
 * offsets, so contamination sits exactly on the surface.
 */

const MODEL = '/models/hand.glb'

/**
 * Longest dimension, in metres. The model includes a forearm, so this spans
 * fingertip to elbow; ~310mm puts the hand itself near a real 190mm.
 */
const TARGET_SPAN = 0.31

const ANCHOR_COUNT = 26

export interface HandMeshProps {
  side: 'left' | 'right'
  onAnchors?: (anchors: HandAnchor[]) => void
}

export function HandMesh({ side, onAnchors }: HandMeshProps) {
  const { scene } = useGLTF(MODEL)

  const { object, anchors, norm } = useMemo(() => {
    const src = scene.clone(true)

    const meshes: THREE.Mesh[] = []
    src.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh)
    })
    meshes.slice(1).forEach((m) => m.removeFromParent())

    const keep = meshes[0]
    if (!keep) {
      return { object: src, anchors: [] as HandAnchor[], norm: { scale: 1, offset: new THREE.Vector3() } }
    }

    keep.castShadow = true
    keep.receiveShadow = true
    keep.material = M.skin

    // Smooth the flat-shaded normals: at 786 triangles the faceting is the
    // first thing that reads at close range.
    keep.geometry = keep.geometry.clone()
    keep.geometry.deleteAttribute('normal')
    keep.geometry.computeVertexNormals()

    /* ---- anchors, sampled off real vertices ---- */
    const pos = keep.geometry.attributes.position as THREE.BufferAttribute
    const gBox = new THREE.Box3().setFromBufferAttribute(pos)
    const gSize = new THREE.Vector3()
    gBox.getSize(gSize)

    // long axis runs fingertips -> elbow, fingers at the low end
    const axis: 'x' | 'y' | 'z' =
      gSize.z >= gSize.x && gSize.z >= gSize.y ? 'z' : gSize.y >= gSize.x ? 'y' : 'x'
    const lo = gBox.min[axis]
    const span = gSize[axis] || 1
    const midY = (gBox.min.y + gBox.max.y) / 2

    const built: HandAnchor[] = []
    const stride = Math.max(1, Math.floor(pos.count / (ANCHOR_COUNT * 3)))

    for (let i = 0; i < pos.count && built.length < ANCHOR_COUNT; i += stride) {
      const p = new THREE.Vector3().fromBufferAttribute(pos, i)
      const t = (p[axis] - lo) / span
      if (t > 0.62) continue // forearm: nothing lands up the arm

      let region: AnchorRegion
      if (t < 0.22) region = 'tip'
      else if (t < 0.36) region = 'nail'
      else if (t < 0.48) region = 'web'
      else region = p.y > midY ? 'back' : 'palm'

      /*
       * Anchors are parented to the MESH ITSELF, in its own vertex space, so
       * they inherit whatever internal node transforms the exporter baked in.
       * Mounting them as siblings and hand-applying a scale silently puts them
       * in a different space to the surface they are supposed to sit on.
       */
      const node = new THREE.Object3D()
      node.position.copy(p)
      keep.add(node)

      built.push({
        node,
        region,
        across: THREE.MathUtils.clamp((p.x - gBox.min.x) / (gSize.x || 1), 0, 1),
        side,
      })
    }

    /*
     * Scale is measured from the ASSEMBLED object, not from raw geometry
     * bounds. The exporter bakes transforms into the node chain above the mesh,
     * so geometry-local bounds are the wrong units — normalising against them
     * produced a hand about fifteen times too small.
     *
     * Derived here and applied declaratively; mutating the object inside an
     * effect is not idempotent, and under StrictMode the second pass measures
     * the already-scaled result and compounds it.
     */
    const box = new THREE.Box3().setFromObject(src)
    const size = new THREE.Vector3()
    box.getSize(size)
    const longest = Math.max(size.x, size.y, size.z)
    const scale = longest > 1e-6 ? TARGET_SPAN / longest : 1
    const centre = new THREE.Vector3()
    box.getCenter(centre)

    return { object: src, anchors: built, norm: { scale, offset: centre.multiplyScalar(-scale) } }
  }, [scene, side])

  const published = useRef(false)
  useEffect(() => {
    if (published.current || !onAnchors || anchors.length === 0) return
    published.current = true
    onAnchors(anchors)
  }, [anchors, onAnchors])

  return (
    <group scale={[side === 'left' ? -1 : 1, 1, 1]}>
      {/* The model's palm faces away from camera by default; this brings it to
          +Z so the timeline's rotations mean what they say. */}
      <group rotation={[0, Math.PI, 0]}>
        <group scale={norm.scale} position={norm.offset}>
          <primitive object={object} />
        </group>
      </group>
    </group>
  )
}

useGLTF.preload(MODEL)
