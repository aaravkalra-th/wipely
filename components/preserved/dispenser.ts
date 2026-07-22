import * as THREE from 'three'

/**
 * The Wipely dispenser, modelled from the product render.
 *
 * This replaces the earlier blue "wallet pad". The real product is a black case
 * with an integrated dispenser: a raised pod on the back, a rounded-rectangle
 * aperture with the wipe emerging through it, and a hinged flap that is both
 * the lid over that aperture and the kickstand the phone leans on.
 *
 * The flap doing two jobs is the whole idea, and it is why `lid` and `stand`
 * are separate inputs onto one hinge rather than two mechanisms: closed it
 * seals the aperture, part-open it exposes a sheet, fully out it holds the
 * phone up.
 *
 * Built imperatively to match the surrounding file, which is plain three.js.
 */

export interface Dispenser {
  group: THREE.Group
  /** 0 shut over the aperture .. 1 open */
  setLid(v: number): void
  /** 0 tucked inside .. 1 sheet drawn out */
  setWipe(v: number): void
  /** 0 folded .. 1 deployed far enough to prop the phone */
  setStand(v: number): void
  update(): void
  dispose(): void
}

/** rounded-rectangle extrusion with the bevel clamped to the real depth */
function roundedBox(w: number, h: number, d: number, r: number, bevel = 0.008) {
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

  const b = Math.min(bevel, d * 0.25)
  const core = Math.max(d - b * 2, 0.001)
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: core,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 3,
    steps: 1,
  })
  geo.translate(0, 0, -core / 2)
  geo.computeVertexNormals()
  return geo
}

/** a rounded rectangle with a rounded-rectangle hole through it */
function frameGeo(w: number, h: number, r: number, hw: number, hh: number, hr: number, d: number) {
  const outer = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  outer.moveTo(x + r, y)
  outer.lineTo(x + w - r, y)
  outer.quadraticCurveTo(x + w, y, x + w, y + r)
  outer.lineTo(x + w, y + h - r)
  outer.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  outer.lineTo(x + r, y + h)
  outer.quadraticCurveTo(x, y + h, x, y + h - r)
  outer.lineTo(x, y + r)
  outer.quadraticCurveTo(x, y, x + r, y)

  const hole = new THREE.Path()
  const hx = -hw / 2
  const hy = -hh / 2
  hole.moveTo(hx + hr, hy)
  hole.lineTo(hx + hw - hr, hy)
  hole.quadraticCurveTo(hx + hw, hy, hx + hw, hy + hr)
  hole.lineTo(hx + hw, hy + hh - hr)
  hole.quadraticCurveTo(hx + hw, hy + hh, hx + hw - hr, hy + hh)
  hole.lineTo(hx + hr, hy + hh)
  hole.quadraticCurveTo(hx, hy + hh, hx, hy + hh - hr)
  hole.lineTo(hx, hy + hr)
  hole.quadraticCurveTo(hx, hy, hx + hr, hy)
  outer.holes.push(hole)

  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: d,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
    steps: 1,
  })
  geo.translate(0, 0, -d / 2)
  geo.computeVertexNormals()
  return geo
}

export function createDispenser(phoneW: number, phoneH: number): Dispenser {
  const group = new THREE.Group()
  const owned: { dispose(): void }[] = []
  const track = <T extends { dispose(): void }>(x: T) => {
    owned.push(x)
    return x
  }

  /* ------------------------------ materials ------------------------------ */
  // Matte black throughout, as the render. A soft clearcoat keeps an edge
  // highlight so the stepped forms stay legible against a black background.
  const matShell = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x121214,
      metalness: 0.15,
      roughness: 0.62,
      clearcoat: 0.35,
      clearcoatRoughness: 0.45,
    })
  )
  const matPod = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x161618,
      metalness: 0.12,
      roughness: 0.55,
      clearcoat: 0.4,
      clearcoatRoughness: 0.4,
    })
  )
  const matSheet = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xf7f8fa,
      roughness: 0.92,
      sheen: 0.6,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color(0xffffff),
      side: THREE.DoubleSide,
    })
  )

  /* -------------------------------- case --------------------------------- */
  const CASE_W = phoneW + 0.1
  const CASE_H = phoneH + 0.1
  const CASE_D = 0.07
  const shell = new THREE.Mesh(track(roundedBox(CASE_W, CASE_H, CASE_D, 0.34, 0.012)), matShell)
  shell.castShadow = true
  shell.receiveShadow = true
  group.add(shell)

  /* --------------------------------- pod --------------------------------- */
  const POD_W = 1.02
  const POD_H = 1.5
  const POD_D = 0.075
  const POD_Y = -0.16

  const pod = new THREE.Mesh(track(roundedBox(POD_W, POD_H, POD_D, 0.16, 0.01)), matPod)
  pod.position.set(0, POD_Y, CASE_D / 2 + POD_D / 2 - 0.005)
  pod.castShadow = true
  pod.receiveShadow = true
  group.add(pod)

  // The inner raised frame, with the aperture cut through it. Modelling the
  // hole rather than faking it with a dark patch is what gives the opening a
  // real lip and a shadow line at this angle.
  const AP_W = 0.4
  const AP_H = 0.56
  const AP_Y = 0.19
  const inner = new THREE.Mesh(
    track(frameGeo(POD_W - 0.14, POD_H - 0.16, 0.12, AP_W, AP_H, 0.15, 0.03)),
    matPod
  )
  inner.position.set(0, POD_Y, CASE_D / 2 + POD_D + 0.008)
  inner.castShadow = true
  group.add(inner)

  /* ------------------------------- sheets -------------------------------- */
  // A shallow stack sitting behind the aperture, plus the one being drawn out.
  const stack = new THREE.Group()
  /*
   * Sits just proud of the pod's front face, inside the aperture in the frame
   * above it. Placed any deeper it is behind that face — the pod is solid, and
   * only the frame has a hole in it — so the opening reads as an empty slot
   * with no wipe in it.
   */
  stack.position.set(0, POD_Y + AP_Y, CASE_D / 2 + POD_D + 0.004)
  group.add(stack)
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(
      track(new THREE.PlaneGeometry(AP_W - 0.05, AP_H - 0.06)),
      matSheet
    )
    s.position.z = -i * 0.008
    stack.add(s)
  }

  /*
   * The emerging sheet. It is a plane bent into a soft fold rather than a flat
   * card: a wipe pinched through a slot pleats, and the render shows exactly
   * that — a V of tissue standing proud of the opening.
   */
  const PULL_W = AP_W - 0.06
  const PULL_H = 0.72
  const pullGeo = track(new THREE.PlaneGeometry(PULL_W, PULL_H, 6, 20))
  const pullBase = new Float32Array(pullGeo.attributes.position.count * 3)
  {
    const p = pullGeo.attributes.position
    for (let i = 0; i < p.count; i++) {
      pullBase[i * 3] = p.getX(i)
      pullBase[i * 3 + 1] = p.getY(i)
      pullBase[i * 3 + 2] = p.getZ(i)
    }
  }
  const pull = new THREE.Mesh(pullGeo, matSheet)
  pull.castShadow = true
  const pullPivot = new THREE.Group()
  pullPivot.position.set(0, POD_Y + AP_Y - AP_H / 2 + 0.04, CASE_D / 2 + POD_D + 0.01)
  pullPivot.add(pull)
  group.add(pullPivot)

  /* --------------------------------- lid ---------------------------------- */
  /*
   * A separate cover over the aperture, hinged along its TOP edge.
   *
   * Previously `lid` and `stand` drove the same hinge at two different angles,
   * so "open case" simply deployed the stand a little less far — they were one
   * mechanism wearing two labels. They are now genuinely different parts: this
   * panel seals the opening, and the flap below it props the phone.
   */
  const LID_W = AP_W + 0.1
  const LID_H = AP_H + 0.02
  const LID_HINGE_Y = POD_Y + AP_Y + AP_H / 2 + 0.02

  const lidHinge = new THREE.Group()
  lidHinge.position.set(0, LID_HINGE_Y, CASE_D / 2 + POD_D + 0.03)
  group.add(lidHinge)

  const lidPanel = new THREE.Mesh(track(roundedBox(LID_W, LID_H, 0.022, 0.11, 0.007)), matPod)
  // hangs down from the hinge so that, shut, it lies exactly over the aperture
  lidPanel.position.y = -LID_H / 2
  lidPanel.castShadow = true
  lidHinge.add(lidPanel)

  /* -------------------------------- stand --------------------------------- */
  /*
   * The leg, below the aperture. Hinged just under the opening and hanging
   * down from there, folding flat against the pod or swinging out to hold the
   * phone up — matching the product render.
   */
  const FLAP_W = POD_W - 0.12
  const APERTURE_BOTTOM = POD_Y + AP_Y - AP_H / 2
  const HINGE_Y = APERTURE_BOTTOM - 0.04
  // reaches to just short of the pod's bottom edge when folded flat
  const FLAP_H = HINGE_Y - (POD_Y - POD_H / 2) - 0.06

  const hinge = new THREE.Group()
  hinge.position.set(0, HINGE_Y, CASE_D / 2 + POD_D + 0.022)
  group.add(hinge)

  const flap = new THREE.Mesh(track(roundedBox(FLAP_W, FLAP_H, 0.026, 0.1, 0.008)), matPod)
  // hangs downward from the hinge rather than standing up from it
  flap.position.y = -FLAP_H / 2
  flap.castShadow = true
  flap.receiveShadow = true
  hinge.add(flap)

  /* ------------------------------- state --------------------------------- */
  let lid = 0
  let wipe = 0
  let stand = 0

  /** how far the lid swings clear of the aperture */
  const LID_ANGLE = -1.45
  /** how far the leg deploys to hold the phone */
  const STAND_ANGLE = -1.15

  function update() {
    // Two independent hinges now, driven by their own inputs.
    lidHinge.rotation.x = lid * LID_ANGLE
    hinge.rotation.x = stand * STAND_ANGLE

    /*
     * The sheet is gated on the LID, which is physically right again now that
     * a real cover exists: you cannot draw a wipe through a shut lid. It is
     * deliberately not gated on the stand — the leg has nothing to do with
     * reaching the sheets.
     */
    const out = wipe * Math.min(1, lid * 1.8)
    pull.visible = out > 0.02
    if (pull.visible) {
      const p = pullGeo.attributes.position
      const len = PULL_H * (0.14 + out * 0.86)
      const k = 2.1 / PULL_H
      for (let i = 0; i < p.count; i++) {
        const bx = pullBase[i * 3]
        const by = pullBase[i * 3 + 1]
        const t = (by + PULL_H / 2) / PULL_H
        const a = k * t * len
        // pinch toward the slot at the root, fan out toward the free end
        const pinch = 0.55 + 0.45 * t
        p.setXYZ(i, bx * pinch, Math.sin(a) / k, (1 - Math.cos(a)) / k)
      }
      p.needsUpdate = true
      pullGeo.computeVertexNormals()
    }

    // The stack recedes as a sheet is taken.
    stack.children.forEach((s, i) => {
      s.position.z = -i * 0.008 - out * 0.01
    })
  }

  update()

  return {
    group,
    setLid(v) {
      lid = v
    },
    setWipe(v) {
      wipe = v
    },
    setStand(v) {
      stand = v
    },
    update,
    dispose() {
      owned.forEach((o) => o.dispose())
      owned.length = 0
    },
  }
}
