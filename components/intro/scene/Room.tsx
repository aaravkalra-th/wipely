'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { G, M, PALETTE, roundedBoxGeometry } from './materials'
import { sceneState } from '@/lib/scene-state'

/**
 * One continuous interior: entrance on the left of frame, basin on the right.
 *
 * The brief asks for the bathroom transition to happen without a hard cut, so
 * there is no second set — the camera simply tracks from the doorway across to
 * the basin in the same room. Everything is neutral plaster, oak and porcelain;
 * no decorative clutter, no futuristic hallway.
 */

/*
 * A wider opening, and the leaf swings a full 90 degrees.
 *
 * Measured: the person's bounding box is 0.62m wide. With a 1.24m opening and
 * the leaf parked at 66 degrees it sat inside the opening at x[-0.55,-0.06],
 * leaving a 0.635m lane between it and the right jamb — 8mm of clearance each
 * side, which is not a clearance, it is a coincidence. Swinging to a full 90
 * parks the leaf flat at x=-0.55 and takes it out of the opening entirely.
 */
/*
 * The leaf is sized to the opening it hangs in, and hinged ON the jamb.
 *
 * It was 1.05 wide in a 1.44m opening, hinged at x=-0.55 while the jamb sits at
 * -0.72 — so it was both too narrow for the frame and floating 170mm clear of
 * the hinge side, which is why it read as hanging in space rather than fitted.
 * 1.40 leaves ~20mm clearance each side, which is what a real door has.
 */
const DOOR_W = 1.4
const JAMB_X = 0.72
const DOOR_SWING = Math.PI / 2
/* header underside sits at y=2.455, so the leaf stops just short of it */
const DOOR_H = 2.42
/** hinge line, just inside the left jamb */
const HINGE_X = -0.7
const WALL_Z = -3.4

export function Room() {
  const door = useRef<THREE.Group>(null)

  const wallGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 0.16), [])
  const doorPanel = useMemo(() => roundedBoxGeometry(DOOR_W, DOOR_H, 0.06, 0.02, 0.008), [])
  const counterGeo = useMemo(() => roundedBoxGeometry(2.1, 0.09, 0.86, 0.03, 0.01), [])
  const basinGeo = useMemo(() => new THREE.CylinderGeometry(0.42, 0.31, 0.2, 44, 1, true), [])

  useFrame(() => {
    /*
     * The door opens INWARD, and the timing is what keeps it off him.
     *
     * Measured: an inward leaf sweeps across the middle of the opening while it
     * travels, and the person's bounding box is 0.62m wide in a 1.24m opening,
     * so any overlap in time means an overlap in space — peak measured
     * intersection was 0.48m.
     *
     * The resolution is that the leaf finishes its swing BEFORE his bounding box
     * reaches the door plane at z=-3.4. Fully open it parks in x[-0.55,-0.06],
     * and he walks at x=0.3 spanning x[-0.01,0.61], which clears it. Swinging
     * outward instead was tried and is worse: it puts the leaf in his approach
     * path on the exterior side, where he spends most of the shot.
     */
    if (door.current) door.current.rotation.y = -sceneState.env.door * DOOR_SWING
  })

  return (
    <group>
      {/* floor */}
      <mesh
        geometry={G.plane}
        material={M.floor}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[26, 26, 1]}
        receiveShadow
      />

      {/* back wall, built around the door opening */}
      <mesh
        geometry={wallGeo}
        material={M.wall}
        name="wallL"
        position={[-2.42, 1.6, WALL_Z]}
        scale={[3.5, 3.2, 1]}
        receiveShadow
        castShadow
      />
      <mesh
        geometry={wallGeo}
        material={M.wall}
        name="wallR"
        position={[2.42, 1.6, WALL_Z]}
        scale={[3.5, 3.2, 1]}
        receiveShadow
        castShadow
      />
      <mesh
        geometry={wallGeo}
        material={M.wall}
        name="wallTop"
        position={[0, 2.83, WALL_Z]}
        scale={[1.45, 0.75, 1]}
        receiveShadow
        castShadow
      />

      {/* door reveal / frame */}
      {/* Named individually, not as a group: a group's AABB spans both jambs
          and swallows the doorway between them, which makes any collision test
          against it report the opening as solid. */}
      <mesh
        name="jambL"
        geometry={wallGeo}
        material={M.trim}
        position={[-JAMB_X, 1.23, WALL_Z]}
        scale={[0.09, 2.46, 1.25]}
      />
      <mesh
        name="jambR"
        geometry={wallGeo}
        material={M.trim}
        position={[JAMB_X, 1.23, WALL_Z]}
        scale={[0.09, 2.46, 1.25]}
      />

      {/* the door itself, hinged on the left jamb */}
      <group ref={door} name="door" position={[HINGE_X, 0, WALL_Z]}>
        <mesh
          geometry={doorPanel}
          material={M.trim}
          position={[DOOR_W / 2, DOOR_H / 2, 0]}
          castShadow
        />
        {/* handle — the surface the contamination came from */}
        <mesh
          geometry={G.cyl}
          material={M.chrome}
          position={[DOOR_W - 0.13, 1.02, 0.07]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[0.022, 0.11, 0.022]}
          castShadow
        />
        <mesh
          geometry={G.cyl}
          material={M.chrome}
          position={[DOOR_W - 0.13, 1.02, 0.15]}
          rotation={[0, 0, Math.PI / 2]}
          scale={[0.02, 0.16, 0.02]}
          castShadow
        />
      </group>

      {/* entry console — where keys and a phone get put down */}
      <group position={[1.75, 0, -2.05]}>
        <mesh geometry={counterGeo} material={M.trim} position={[0, 0.84, 0]} castShadow receiveShadow />
        {[
          [-0.92, -0.36],
          [0.92, -0.36],
          [-0.92, 0.36],
          [0.92, 0.36],
        ].map(([x, z], i) => (
          <mesh
            key={i}
            geometry={G.box}
            material={M.trim}
            position={[x, 0.42, z]}
            scale={[0.05, 0.84, 0.05]}
            castShadow
          />
        ))}
      </group>

      {/*
        Basin, in the same room — the camera tracks here, it does not cut.

        A vessel bowl standing on the counter rather than an undermount sink.
        An undermount would need a hole cut through the counter slab, and
        without one the bowl simply hides underneath it and the wash reads as
        happening over a bare worktop.
      */}
      <group position={[-2.15, 0, -1.05]}>
        <mesh geometry={counterGeo} material={M.trim} position={[0, 0.92, 0]} castShadow receiveShadow />

        {/* bowl: rim at 1.115, floor at 0.975 */}
        <mesh geometry={basinGeo} position={[0, 1.045, 0]} scale={[0.46, 0.7, 0.46]} castShadow receiveShadow>
          <meshPhysicalMaterial
            color={PALETTE.porcelain}
            roughness={0.18}
            clearcoat={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh
          geometry={G.cyl}
          material={M.porcelain}
          position={[0, 0.978, 0]}
          scale={[0.14, 0.012, 0.14]}
          receiveShadow
        />

        {/* tap: column, spout, outlet */}
        <mesh
          geometry={G.cyl}
          material={M.chrome}
          position={[0, 1.17, -0.3]}
          scale={[0.013, 0.42, 0.013]}
          castShadow
        />
        <mesh
          geometry={G.cyl}
          material={M.chrome}
          position={[0, 1.37, -0.19]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[0.012, 0.24, 0.012]}
          castShadow
        />
        <mesh
          geometry={G.cyl}
          material={M.chrome}
          position={[0, 1.345, -0.08]}
          scale={[0.013, 0.06, 0.013]}
        />
      </group>

      {/* skirting, to give the wall a believable base line */}
      <mesh geometry={G.box} material={M.trim} position={[-2.3, 0.06, WALL_Z + 0.1]} scale={[3.5, 0.12, 0.03]} />
      <mesh geometry={G.box} material={M.trim} position={[2.3, 0.06, WALL_Z + 0.1]} scale={[3.5, 0.12, 0.03]} />
    </group>
  )
}

/** Cool daylight spilling through the open doorway. */
export function DoorwayLight() {
  const light = useRef<THREE.SpotLight>(null)
  useFrame(() => {
    if (light.current) light.current.intensity = 5.5 * sceneState.env.door * (1 - sceneState.cam.studio)
  })
  return (
    <spotLight
      ref={light}
      position={[0, 2.1, WALL_Z - 1.4]}
      target-position={[0, 0.6, 0]}
      angle={0.7}
      penumbra={0.85}
      color={0xbcd4ff}
      intensity={0}
      distance={14}
      castShadow
      shadow-mapSize={[1024, 1024]}
      shadow-bias={-0.0004}
    />
  )
}

export { PALETTE }
