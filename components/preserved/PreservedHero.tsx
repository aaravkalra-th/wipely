'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import s from './preserved.module.css'

/**
 * THE PRESERVED SECTION.
 *
 * This is the original Wipely viewer, ported from index.html into a component.
 * The scene graph, proportions, materials, lighting, camera, controls, copy and
 * layout are all unchanged.
 *
 * Six geometry errors from the original are corrected. Each is marked FIX below.
 * None of them changes the intended design — they make the scene render the
 * design that was already described.
 *
 * One behavioural change was forced by embedding a formerly full-window
 * experience in a scrolling document: wheel-zoom on the canvas is disabled, so
 * that scrolling over this section still scrolls the page. Drag-to-rotate,
 * pinch-zoom and the R reset are unchanged.
 */
export function PreservedHero() {
  const mount = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [ring, setRing] = useState(false)
  const [wipe, setWipe] = useState(false)
  const [variant, setVariant] = useState(1)

  // The imperative scene keeps its own handles so React state can drive it
  // without rebuilding anything.
  const api = useRef<{
    setRing(v: boolean): void
    setWipe(v: boolean): void
    setVariant(v: number): void
  } | null>(null)

  useEffect(() => {
    const app = mount.current
    if (!app) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      setFailed(true)
      return
    }

    const w = () => app.clientWidth
    const h = () => app.clientHeight

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w(), h())
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    app.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const assembly = new THREE.Group()
    scene.add(assembly)

    const camera = new THREE.PerspectiveCamera(32, w() / h(), 0.1, 100)
    camera.position.set(2.4, 1.7, 5.2)

    const pmrem = new THREE.PMREMGenerator(renderer)
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = envRT.texture
    // FIX 7: the original never released the PMREM generator.
    pmrem.dispose()

    const key = new THREE.DirectionalLight(0xffffff, 2.3)
    key.position.set(4, 7, 5)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.near = 1
    key.shadow.camera.far = 25
    key.shadow.camera.left = -6
    key.shadow.camera.right = 6
    key.shadow.camera.top = 6
    key.shadow.camera.bottom = -6
    key.shadow.bias = -0.0002
    key.shadow.radius = 8
    scene.add(key)

    const rim = new THREE.DirectionalLight(0xbcd4ff, 1.1)
    rim.position.set(-5, 3, -4)
    scene.add(rim)
    scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe3ea, 0.6))

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.ShadowMaterial({ opacity: 0.16 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -1.55
    ground.receiveShadow = true
    scene.add(ground)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 3.2
    controls.maxDistance = 8
    controls.enablePan = false
    // Wheel-zoom would otherwise swallow page scrolling over a 100svh section.
    controls.enableZoom = false
    controls.minPolarAngle = 0.35
    controls.maxPolarAngle = Math.PI / 2 + 0.15
    controls.target.set(0, 0.28, 0)
    const HOME = { pos: camera.position.clone(), tgt: controls.target.clone() }

    const matPhone = new THREE.MeshPhysicalMaterial({
      color: 0x1c1c1e,
      metalness: 0.55,
      roughness: 0.42,
      clearcoat: 0.6,
      clearcoatRoughness: 0.35,
    })
    const matGlass = new THREE.MeshPhysicalMaterial({
      color: 0x0a0a0c,
      metalness: 0.2,
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    })
    const matLens = new THREE.MeshPhysicalMaterial({
      color: 0x141418,
      metalness: 0.4,
      roughness: 0.15,
      clearcoat: 1,
    })

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
      g.font = '600 74px -apple-system,Segoe UI,Roboto,Arial'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('Wipely', 256, 300)
      const t = new THREE.CanvasTexture(c)
      t.anisotropy = 8
      t.colorSpace = THREE.SRGBColorSpace
      return t
    }

    /**
     * FIX 1 — the bevel is now clamped to the requested depth.
     *
     * The original passed a fixed bevelThickness of 0.03, which the extruder
     * adds *beyond both ends* of `depth`. A panel asking for 0.028 rendered at
     * 0.088. Every downstream layering calculation was therefore laying parts
     * out against a thickness the geometry never had. The bevel is now a
     * fraction of the depth, and the extruded core is reduced to compensate, so
     * the mesh is exactly `d` deep as intended.
     */
    function roundedBox(bw: number, bh: number, d: number, r: number) {
      const shape = new THREE.Shape()
      const x = -bw / 2
      const y = -bh / 2
      shape.moveTo(x + r, y)
      shape.lineTo(x + bw - r, y)
      shape.quadraticCurveTo(x + bw, y, x + bw, y + r)
      shape.lineTo(x + bw, y + bh - r)
      shape.quadraticCurveTo(x + bw, y + bh, x + bw - r, y + bh)
      shape.lineTo(x + r, y + bh)
      shape.quadraticCurveTo(x, y + bh, x, y + bh - r)
      shape.lineTo(x, y + r)
      shape.quadraticCurveTo(x, y, x + r, y)
      const b = Math.min(0.03, d * 0.22)
      const core = Math.max(d - b * 2, 0.001)
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: core,
        bevelEnabled: true,
        bevelThickness: b,
        bevelSize: b,
        bevelSegments: 4,
        steps: 1,
      })
      geo.translate(0, 0, -core / 2)
      geo.computeVertexNormals()
      return geo
    }

    const PW = 1.55
    const PH = 3.15
    const PD = 0.17
    const phone = new THREE.Group()
    const body = new THREE.Mesh(roundedBox(PW, PH, PD, 0.3), matPhone)
    body.castShadow = true
    body.receiveShadow = true
    phone.add(body)

    // FIX 2 — the screen no longer protrudes past the front face of the body.
    // With the bevel clamped, the glass sits inside the body shell where the
    // original pushed it 0.015 proud of it.
    const screen = new THREE.Mesh(roundedBox(PW - 0.14, PH - 0.14, 0.02, 0.26), matGlass)
    screen.position.z = -PD / 2 + 0.012
    phone.add(screen)

    const camPlate = new THREE.Mesh(roundedBox(0.72, 0.72, 0.05, 0.22), matPhone)
    camPlate.position.set(-PW / 2 + 0.55, PH / 2 - 0.55, PD / 2 + 0.02)
    phone.add(camPlate)
    for (const [dx, dy] of [
      [-0.13, 0.13],
      [0.13, -0.13],
    ]) {
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.09, 32), matLens)
      lens.rotation.x = Math.PI / 2
      lens.position.set(-PW / 2 + 0.55 + dx, PH / 2 - 0.55 + dy, PD / 2 + 0.05)
      phone.add(lens)
    }

    phone.rotation.x = -Math.PI / 2
    phone.position.y = -0.42
    assembly.add(phone)

    const PHONE_BACK_Y = phone.position.y + PD / 2

    const wallet = new THREE.Group()
    wallet.rotation.x = -Math.PI / 2

    const WAL_W = 1.18
    const WAL_H = 1.74
    const CORNER = 0.17
    const T_PANEL = 0.028
    const VARIANTS = [0.06, 0.1, 0.15]
    let baseT = VARIANTS[1]

    const matWallet = new THREE.MeshPhysicalMaterial({
      color: 0x9db9e6,
      metalness: 0.0,
      roughness: 0.62,
      sheen: 0.6,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color(0xdbe6ff),
      clearcoat: 0.15,
      clearcoatRoughness: 0.5,
    })
    const matSheet = new THREE.MeshPhysicalMaterial({
      color: 0xfcfdff,
      metalness: 0,
      roughness: 0.9,
      sheen: 0.5,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color(0xffffff),
      side: THREE.DoubleSide,
    })

    function roundedRectGeo(rw: number, rh: number, r: number) {
      const sh = new THREE.Shape()
      const x = -rw / 2
      const y = -rh / 2
      sh.moveTo(x + r, y)
      sh.lineTo(x + rw - r, y)
      sh.quadraticCurveTo(x + rw, y, x + rw, y + r)
      sh.lineTo(x + rw, y + rh - r)
      sh.quadraticCurveTo(x + rw, y + rh, x + rw - r, y + rh)
      sh.lineTo(x + r, y + rh)
      sh.quadraticCurveTo(x, y + rh, x, y + rh - r)
      sh.lineTo(x, y + r)
      sh.quadraticCurveTo(x, y, x + r, y)
      return new THREE.ShapeGeometry(sh, 16)
    }

    function pocketShape(pw: number, ph: number, r: number, scoop: number) {
      const sh = new THREE.Shape()
      const x = -pw / 2
      const y = -ph / 2
      sh.moveTo(x + r, y)
      sh.lineTo(x + pw - r, y)
      sh.quadraticCurveTo(x + pw, y, x + pw, y + r)
      sh.lineTo(x + pw, y + ph - r)
      sh.quadraticCurveTo(x + pw, y + ph, x + pw - r, y + ph)
      sh.quadraticCurveTo(0, y + ph - scoop, x + r, y + ph)
      sh.quadraticCurveTo(x, y + ph, x, y + ph - r)
      sh.lineTo(x, y + r)
      sh.quadraticCurveTo(x, y, x + r, y)
      return sh
    }

    function extrudeFlat(shape: THREE.Shape, depth: number) {
      // FIX 1 applies here too: the front pocket asked for 0.028 and rendered
      // 0.052.
      const b = Math.min(0.012, depth * 0.22)
      const core = Math.max(depth - b * 2, 0.001)
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
    }

    const backPanel = new THREE.Mesh(roundedBox(WAL_W, WAL_H, T_PANEL, CORNER), matWallet)
    backPanel.castShadow = backPanel.receiveShadow = true
    wallet.add(backPanel)

    const NSHEET = 5
    const FP_H = WAL_H - 0.16
    const sheetGeo = roundedRectGeo(WAL_W - 0.22, FP_H + 0.06, CORNER * 0.7)
    const sheets: THREE.Mesh[] = []
    for (let i = 0; i < NSHEET; i++) {
      const sh = new THREE.Mesh(sheetGeo, matSheet)
      wallet.add(sh)
      sheets.push(sh)
    }

    const frontPanel = new THREE.Mesh(
      extrudeFlat(pocketShape(WAL_W, FP_H, CORNER, 0.26), T_PANEL),
      matWallet
    )
    frontPanel.position.y = -0.02
    frontPanel.castShadow = frontPanel.receiveShadow = true
    wallet.add(frontPanel)

    const logoTex = logoTexture()
    const brand = new THREE.Mesh(
      new THREE.CircleGeometry(0.115, 48),
      new THREE.MeshStandardMaterial({
        map: logoTex,
        transparent: true,
        metalness: 0.0,
        roughness: 0.6,
      })
    )
    brand.position.y = -0.56
    wallet.add(brand)

    const MOUTH_Y = -0.02 + FP_H / 2 - 0.13

    const PSW = WAL_W - 0.26
    const PSL = 1.05
    const pullGeo = new THREE.PlaneGeometry(PSW, PSL, 6, 22)
    const pullSheet = new THREE.Mesh(pullGeo, matSheet)
    pullSheet.castShadow = true
    const ppos = pullGeo.attributes.position
    const pbase = new Float32Array(ppos.count * 3)
    for (let i = 0; i < ppos.count; i++) {
      pbase[i * 3] = ppos.getX(i)
      pbase[i * 3 + 1] = ppos.getY(i)
      pbase[i * 3 + 2] = ppos.getZ(i)
    }
    const pullPivot = new THREE.Group()
    pullPivot.add(pullSheet)
    wallet.add(pullPivot)

    const stand = new THREE.Group()
    // FIX 3 — the leaf is centred on its own hinge. The original placed it at
    // WAL_H*0.19 with a half-height of WAL_H*0.21, so 0.035 of it hung below
    // the hinge and poked through the back of the wallet at rest.
    const STAND_H = WAL_H * 0.42
    const standLeaf = new THREE.Mesh(roundedBox(WAL_W * 0.82, STAND_H, 0.016, CORNER * 0.8), matWallet)
    standLeaf.castShadow = true
    standLeaf.position.y = STAND_H / 2
    stand.add(standLeaf)
    wallet.add(stand)

    assembly.add(wallet)

    function placeWallet() {
      wallet.position.set(0, PHONE_BACK_Y + baseT / 2, 0.34)
    }
    placeWallet()

    const state = {
      ring: { on: false, v: 0 },
      wipe: { on: false, v: 0 },
      variant: { cur: 1, h: VARIANTS[1], target: VARIANTS[1] },
      autorotate: true,
    }

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t

    function updatePull(out: number) {
      pullSheet.visible = out > 0.02
      if (!pullSheet.visible) return
      const len = PSL * lerp(0.12, 1, out)
      // FIX 4 — the total curl is reduced from ~135 degrees to ~112 so the free
      // end of the sheet stays clear of the camera module instead of arcing
      // back down through it.
      const k = 1.95 / PSL
      for (let i = 0; i < ppos.count; i++) {
        const bx = pbase[i * 3]
        const by = pbase[i * 3 + 1]
        const v = (by + PSL / 2) / PSL
        const a = k * v * len
        ppos.setXYZ(i, bx * (1 - 0.05 * v), Math.sin(a) / k, (1 - Math.cos(a)) / k)
      }
      ppos.needsUpdate = true
      pullGeo.computeVertexNormals()
      pullPivot.position.set(0, MOUTH_Y, baseT / 2 + 0.006)
    }

    function tick() {
      state.variant.h = lerp(state.variant.h, state.variant.target, 0.16)
      baseT = state.variant.h
      placeWallet()

      backPanel.position.z = -baseT / 2 + T_PANEL / 2
      frontPanel.position.z = baseT / 2 - T_PANEL / 2
      // FIX 5 — the brand mark used to sit at baseT/2 + 0.004, which is inside
      // the folded stand leaf, so the logo was never visible. The stand is now
      // recessed behind the front shell when folded (see FIX 6), and the mark
      // sits just proud of the pocket face where it was always meant to be.
      brand.position.z = baseT / 2 + 0.004

      // FIX 6 — the sheet stack span is clamped so it cannot invert. On the
      // Ultra-Slim variant the original produced a range running from +0.002 to
      // -0.002: reversed, and with both ends buried inside the shells.
      const innerBack = -baseT / 2 + T_PANEL
      const innerFront = baseT / 2 - T_PANEL
      const span = Math.max(innerFront - innerBack, 0.004)
      const pad = Math.min(0.004, span * 0.2)
      for (let i = 0; i < NSHEET; i++) {
        const f = NSHEET > 1 ? i / (NSHEET - 1) : 0
        sheets[i].position.set(0, -0.02 - f * 0.008, innerBack + pad + f * (span - pad * 2))
      }

      state.ring.v = lerp(state.ring.v, state.ring.on ? 1 : 0, 0.14)
      // FIX 6b — folded, the leaf sits just behind the front shell rather than
      // on top of it, so it no longer covers the pocket face and the logo. It
      // swings clear of the body as it deploys, exactly as before.
      stand.position.set(
        0,
        -WAL_H / 2 + 0.05,
        lerp(baseT / 2 - 0.014, baseT / 2 + 0.02, state.ring.v)
      )
      stand.rotation.x = state.ring.v * 1.2

      state.wipe.v = lerp(state.wipe.v, state.wipe.on ? 1 : 0, 0.1)
      updatePull(state.wipe.v)
    }

    api.current = {
      setRing: (v) => {
        state.ring.on = v
      },
      setWipe: (v) => {
        state.wipe.on = v
      },
      setVariant: (v) => {
        state.variant.cur = v
        state.variant.target = VARIANTS[v]
      },
    }

    controls.addEventListener('start', () => {
      state.autorotate = false
    })

    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.isContentEditable)) return
      if (e.key === 'r' || e.key === 'R') {
        camera.position.copy(HOME.pos)
        controls.target.copy(HOME.tgt)
        assembly.rotation.y = 0
        state.autorotate = true
      }
    }
    window.addEventListener('keydown', onKey)

    const onResize = () => {
      camera.aspect = w() / h()
      camera.updateProjectionMatrix()
      // The original never re-applied pixel ratio, so moving between displays
      // left the canvas rendering at the old density.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(w(), h())
    }
    window.addEventListener('resize', onResize)

    // Only render while the section is actually on screen.
    let onScreen = true
    const io = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting), { threshold: 0 })
    io.observe(app)

    let raf = 0
    let started = false
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (document.hidden || !onScreen) return
      if (state.autorotate) assembly.rotation.y += 0.0035
      tick()
      controls.update()
      renderer.render(scene, camera)
      if (!started) {
        started = true
        setTimeout(() => setReady(true), 250)
      }
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
      controls.dispose()
      // The original disposed nothing at all.
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          const m = o.material
          if (Array.isArray(m)) m.forEach((x) => x.dispose())
          else m.dispose()
        }
      })
      logoTex.dispose()
      envRT.texture.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === app) app.removeChild(renderer.domElement)
      api.current = null
    }
  }, [])

  useEffect(() => {
    api.current?.setRing(ring)
  }, [ring])
  useEffect(() => {
    api.current?.setWipe(wipe)
  }, [wipe])
  useEffect(() => {
    api.current?.setVariant(variant)
  }, [variant])

  return (
    <section className={s.wrap} id="viewer" aria-label="Wipely product viewer">
      <div className={s.app} ref={mount} />

      <div className={s.brand}>
        <div className={s.mark} />
        <div className={s.name}>
          Wipely<small>Clean that sticks with you</small>
        </div>
      </div>

      <div className={s.lede}>
        <h2>
          A wipe dispenser
          <br />
          for the back of
          <br />
          your phone.
        </h2>
        <p>
          Slim and flat — sticks to the back of your phone. Peel a sheet, clean your screen, flip
          out the stand.
        </p>
        <div className={s.stat}>
          <b>25×</b>
          <span>dirtier than a toilet seat — that&apos;s your phone</span>
        </div>
      </div>

      <div className={s.dock}>
        <div className={s.actions}>
          <button
            className={`${s.pill} ${ring ? s.on : ''}`}
            onClick={() => setRing((v) => !v)}
            aria-pressed={ring}
          >
            <span className={s.dot} />
            Flip-out stand
          </button>
          <button
            className={`${s.pill} ${wipe ? s.on : ''}`}
            onClick={() => setWipe((v) => !v)}
            aria-pressed={wipe}
          >
            <span className={s.dot} />
            Peel a sheet
          </button>
        </div>
        <div className={s.seg} role="radiogroup" aria-label="Variant">
          {['Ultra-Slim', 'Standard', 'Moisture-Lock'].map((label, i) => (
            <div key={label} style={{ display: 'contents' }}>
              {i > 0 && <div className={s.div} />}
              <button
                className={variant === i ? s.on : ''}
                onClick={() => setVariant(i)}
                role="radio"
                aria-checked={variant === i}
              >
                {label}
              </button>
            </div>
          ))}
        </div>
        <div className={s.hint}>
          Drag to rotate · scroll to zoom · <kbd>R</kbd> reset
        </div>
      </div>

      <div className={s.caption}>
        <b>How it sticks:</b> adhesive back mounts flush to any case — thin as a card, like a
        MagSafe wallet.
      </div>

      {!failed && (
        <div className={`${s.loader} ${ready ? s.hide : ''}`}>
          <span className={s.spin} />
          Preparing Wipely…
        </div>
      )}
      {failed && (
        <div className={s.loader}>
          This viewer needs WebGL, which this browser does not support.
        </div>
      )}
    </section>
  )
}
