'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import s from './preserved.module.css'
import { createDispenser } from './dispenser'

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
  const [lid, setLid] = useState(false)
  const [wipe, setWipe] = useState(false)
  const [stand, setStand] = useState(false)

  // The imperative scene keeps its own handles so React state can drive it
  // without rebuilding anything.
  const api = useRef<{
    setLid(v: boolean): void
    setWipe(v: boolean): void
    setStand(v: boolean): void
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

    /*
     * The dispenser, remodelled from the product render: a black case with a
     * raised pod, a rounded-rectangle aperture, and a flap that is both the lid
     * and the kickstand. Replaces the earlier blue wallet pad — see
     * ./dispenser.ts for the geometry and why one hinge does two jobs.
     */
    const dispenser = createDispenser(PW, PH)
    dispenser.group.rotation.x = -Math.PI / 2
    dispenser.group.position.set(0, PHONE_BACK_Y + 0.035, 0)
    assembly.add(dispenser.group)

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t

    const state = {
      lid: { on: false, v: 0 },
      wipe: { on: false, v: 0 },
      stand: { on: false, v: 0 },
      autorotate: true,
    }

    function tick() {
      state.lid.v = lerp(state.lid.v, state.lid.on ? 1 : 0, 0.14)
      state.wipe.v = lerp(state.wipe.v, state.wipe.on ? 1 : 0, 0.12)
      state.stand.v = lerp(state.stand.v, state.stand.on ? 1 : 0, 0.12)

      dispenser.setLid(state.lid.v)
      dispenser.setWipe(state.wipe.v)
      dispenser.setStand(state.stand.v)
      dispenser.update()

      // Standing tips the whole assembly back onto the deployed flap, which is
      // the pose in the product render.
      assembly.rotation.x = state.stand.v * 0.2
    }

    api.current = {
      setLid: (v) => {
        state.lid.on = v
      },
      setWipe: (v) => {
        state.wipe.on = v
      },
      setStand: (v) => {
        state.stand.on = v
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

    const drawFrame = () => {
      tick()
      controls.update()
      renderer.render(scene, camera)
    }

    /*
     * Draw one frame synchronously before the loop starts.
     *
     * The loop skips rendering while the tab is hidden or the section is
     * scrolled away, which is right for battery — but it also used to skip the
     * flag that clears the loader, and requestAnimationFrame is throttled to
     * nothing on a background tab. Loading the page in a background tab
     * therefore left "Preparing Wipely…" on screen indefinitely. One frame up
     * front costs nothing and guarantees a correct first paint.
     */
    drawFrame()
    setTimeout(() => setReady(true), 250)

    // Dev hook: force a frame when the environment throttles rAF, so the
    // viewer can be inspected without a visible, focused tab.
    if (process.env.NODE_ENV !== 'production') {
      ;(window as unknown as { __preservedDraw?: () => void }).__preservedDraw = drawFrame
    }

    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (document.hidden || !onScreen) return
      if (state.autorotate) assembly.rotation.y += 0.0035
      drawFrame()
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
      envRT.texture.dispose()
      dispenser.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === app) app.removeChild(renderer.domElement)
      api.current = null
    }
  }, [])

  useEffect(() => {
    api.current?.setLid(lid)
  }, [lid])
  useEffect(() => {
    api.current?.setWipe(wipe)
  }, [wipe])
  useEffect(() => {
    api.current?.setStand(stand)
  }, [stand])

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
        {/* The three things the product actually does. Replaces the old
            stand/peel pair and the variant selector, which described the
            earlier pad rather than this case. */}
        <div className={s.actions}>
          <button
            className={`${s.pill} ${lid ? s.on : ''}`}
            onClick={() => setLid((v) => !v)}
            aria-pressed={lid}
          >
            <span className={s.dot} />
            {lid ? 'Close case' : 'Open case'}
          </button>
          <button
            className={`${s.pill} ${wipe ? s.on : ''}`}
            onClick={() => setWipe((v) => !v)}
            aria-pressed={wipe}
          >
            <span className={s.dot} />
            Pull out a wipe
          </button>
          <button
            className={`${s.pill} ${stand ? s.on : ''}`}
            onClick={() => setStand((v) => !v)}
            aria-pressed={stand}
          >
            <span className={s.dot} />
            Stand
          </button>
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
