# Assets

**This project currently ships zero `.glb` files.** Every object in the
introduction — the room, the hands, the phone, the product — is authored
procedurally in code, the same way the original `index.html` was built.

That was a deliberate decision, not an oversight. The brief asked for a
Draco-compressed GLB pipeline and a Mixamo-derived biped, and neither could be
produced here:

- No product, phone, hand or character model was supplied with the project.
- Mixamo requires an Adobe sign-in, which is not something to do on someone
  else's behalf.
- A procedurally-generated "realistic human" would land squarely in the
  generic-AI-people territory the brief explicitly rules out.

So the sequence is composed to work **without** a character: scene 1 frames a
single hand in the near foreground with its forearm cropped by the frame edge,
which implies a person standing just outside the shot. See the comment block at
the `enter-home` label in `components/intro/master-timeline.ts`.

## The loader pipeline is already wired

`lib/gltf.ts` configures `DRACOLoader` and `KTX2Loader` and is ready to use.
Decoders are fetched at runtime from `/public`, never bundled:

```
public/decoders/draco/     # from three/examples/jsm/libs/draco/
public/decoders/basis/     # from three/examples/jsm/libs/basis/
```

Copy those two directories out of `node_modules/three/examples/jsm/libs/` before
loading any compressed asset.

## Asset contract

When real models arrive, they drop into the existing scene graph without
touching the timeline, provided they meet the following.

### Units and orientation

- **Metres.** The whole scene is life size: the doorway is 2.25 m, the counter
  top is 0.965 m, a palm is 85 mm across. An asset authored at the wrong scale
  will silently break every camera distance in the timeline.
- **+Y up, -Z forward.** Origin at the natural resting point (feet for a
  character, the geometric centre of the back face for the product).

### Expected nodes

| Asset | Required node names |
| --- | --- |
| `product.glb` | `Shell_Back`, `Shell_Front`, `Sheet_00`…`Sheet_04`, `Stand`, `Brand` |
| `phone.glb` | `Body`, `Screen`, `CameraPlate`, `Lens_00`, `Lens_01` |
| `hand.glb` | skinned mesh `Hand`, plus empties named `anchor_tip_*`, `anchor_nail_*`, `anchor_web_*`, `anchor_palm_*`, `anchor_back_*` |

The germ field discovers its attachment points by name from that last group, so
the anchor empties are load-bearing, not decoration. `components/intro/scene/Hand.tsx`
documents what each region means and how it orders the wash.

### Animation clips

| Clip | Length | Notes |
| --- | --- | --- |
| `walk_in` | ~3 s | Must be refined off the Mixamo original — retimed, foot-planted, with the arm swing damped. An untouched stock loop is not acceptable. |
| `reach` | ~1 s | Additive on the upper body. |
| `wash_scrub` | ~2.6 s, looping | Should match the rub cycle already driven by `hands.rub`. |

### Textures

KTX2 (UASTC for normal maps, ETC1S for albedo/roughness). Keep the introduction's
total compressed payload under ~2 MB — it loads before anything else on the page.

## Swapping a procedural object for a real one

Each scene component is self-contained and reads only from `lib/scene-state.ts`.
To replace one, keep the same props and the same `useFrame` contract; the
timeline neither knows nor cares what is drawing.

---

## Assets actually in this repo

### `public/models/person.glb` — 493 KB

| | |
| --- | --- |
| Source | Quaternius, "Animated Men Pack", via [Poly Pizza](https://poly.pizza/bundle/Animated-Men-Pack-DAC9SDgMQT) |
| License | **CC0 1.0 Universal (public domain)** — commercial use, no attribution required |
| Contents | 1 skinned mesh (6 primitives), 45 nodes, 1 skin, 11 animation clips, no textures |
| Clip used | `HumanArmature|Man_Walk` (1.04 s cycle) |

Attribution is not required by CC0, but the provenance is recorded here because
knowing where an asset came from matters more than the licence obliging it.

**Known integration gotchas**, all of which cost real time to find:

1. **Node names are renamed on import.** three's GLTFLoader strips characters
   that are illegal in animation property-binding paths, so `Foot.L_end` becomes
   `FootL_end`. Looking up the authored name returns `undefined` silently.
   `Character.tsx` uses a tolerant lookup that tries both.
2. **`Box3.setFromObject` is useless on this rig.** Its bind-pose geometry
   bounds are 0.007 units tall and unrelated to the drawn result. Scale is
   derived from bone world positions (`Head_end` to `Foot*_end`) instead, once,
   after the mixer has posed the rig.
3. **Clone with `SkeletonUtils.clone`, never `Object3D.clone`.** The latter
   leaves the copied mesh bound to the original skeleton.
4. **The bind pose is a T-pose.** Blending an animated bone toward it does not
   damp motion, it pulls toward T-pose. Any runtime pose correction must be
   absolute and derived from a neutral reference, never a relative `multiply` —
   a relative one compounds every frame on bones the clip does not write.

### Still missing

A high-poly hand for the macro shots in scenes 2–5. Nothing suitable exists
under a permissive licence without an account; free game-resolution hands are
worse at that framing than the procedural geometry already in
`components/intro/scene/Hand.tsx`.

### `public/models/hand.glb` — 107 KB

| | |
| --- | --- |
| Source | "Low Poly Hand" by **ronildo.facanha**, via [Sketchfab](https://sketchfab.com/3d-models/low-poly-hand-3d-model-19c9ac5c369a468a95f081a3cc2ad4ac) |
| License | **CC BY 4.0 — attribution is required.** Credited in the page footer via `ATTRIBUTIONS` in `content/copy.ts`. Do not remove that credit while this asset ships. |
| Contents | 4 identical meshes (512 verts / 786 tris each), 11 nodes, **0 skins**, 1 material, no textures |

**Two things to know:**

1. **It ships four coincident duplicates.** The advertised "3.1k triangles" is one
   786-triangle hand copied four times, stacked exactly. `HandMesh` keeps the
   first and drops the rest — otherwise it is 4x the draw calls and z-fighting
   on every shared face.

2. **It is not rigged, and it cannot be auto-rigged from its geometry.** This was
   measured, not assumed. Clustering the distal vertices to find five fingers
   fails at every threshold:

   | link distance | result |
   | --- | --- |
   | 2 units | 42 clusters — fragments into vertex pairs |
   | 4 units | 24 clusters, 3 of meaningful size |
   | 6 units | 11 clusters — merges into two blobs |

   The distal region holds 56 vertices across five fingers. Adjacent finger
   surfaces sit closer together than consecutive vertices within one finger, so
   no threshold separates them. There is no way to determine that a vertex
   belongs to the index rather than the middle finger, and guessing tears the
   mesh when it curls.

   **To get finger articulation**, the mesh needs bones added by hand in
   Blender: select each finger, add a 3-bone chain, weight-paint, re-export as
   `.glb`. Roughly 20-30 minutes for someone who knows Blender. `HandMesh` would
   then read the skeleton instead of rendering rigid.

Until then the hand is rigid and articulation is carried by whole-hand motion.
The sequence mostly does not need curl — the one place it costs something is the
phone touch, where the other fingers cannot fold away behind the index.
