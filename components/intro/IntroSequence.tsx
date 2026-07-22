'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import s from './intro.module.css'
import { buildMasterTimeline, type TimelineRefs } from './master-timeline'
import { ReducedMotionIntro } from './ReducedMotionIntro'
import { INTRO_LINES, INTRO_STEPS, SCROLL_CUE, SKIP_LABEL } from '@/content/copy'
import { useScrollLock } from '@/lib/use-scroll-lock'
import { startLenis } from '@/lib/lenis'
import { resetSceneState } from '@/lib/scene-state'

// The WebGL stage is the largest chunk on the page and is useless on the
// server, so it is split out and loaded on the client only.
const Stage = dynamic(() => import('./Stage').then((m) => m.Stage), { ssr: false })

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger)

function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export function IntroSequence({ onUnlock }: { onUnlock: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const progressTrack = useRef<HTMLDivElement>(null)
  const progressFill = useRef<HTMLDivElement>(null)
  const cue = useRef<HTMLDivElement>(null)
  const ui = useRef<HTMLDivElement>(null)
  const scrim = useRef<HTMLDivElement>(null)
  const lineEls = useRef<Record<string, HTMLElement | null>>({})
  const stepEls = useRef<(HTMLElement | null)[]>([])
  const tlRef = useRef<gsap.core.Timeline | null>(null)

  const [mode, setMode] = useState<'pending' | 'full' | 'reduced' | 'fallback'>('pending')
  const [finished, setFinished] = useState(false)

  // Decide which introduction to run. Reduced motion and missing WebGL both
  // route away from the cinematic path entirely rather than degrading it.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) setMode('reduced')
    else if (!webglAvailable()) setMode('fallback')
    else setMode('full')
  }, [])

  const unlock = useCallback(() => {
    if (finished) return

    // Release the lock synchronouslyrather than waiting for useScrollLock's
    // effect to run. ScrollTrigger measures the document to lay out its pin,
    // and while `is-locked` is applied the document has no scrollable height —
    // measuring against that leaves the pin stuck and the handoff never fires.
    document.documentElement.classList.remove('is-locked')

    setFinished(true)
    onUnlock()
    // Lenis starts only now, and never for reduced motion.
    startLenis()
  }, [finished, onUnlock])

  // Reinforce the progress indicator when scrolling is attempted, rather than
  // shaking the viewport at the user.
  const nudgeTimer = useRef<number | null>(null)
  const onScrollAttempt = useCallback(() => {
    const el = progressTrack.current
    if (!el) return
    el.dataset.nudge = 'true'
    if (nudgeTimer.current) window.clearTimeout(nudgeTimer.current)
    nudgeTimer.current = window.setTimeout(() => {
      el.dataset.nudge = 'false'
    }, 700)
  }, [])

  useScrollLock(!finished, onScrollAttempt)

  // `unlock` changes identity once it fires, and it must not be allowed to tear
  // down and rebuild the timeline it was called from.
  const unlockRef = useRef(unlock)
  unlockRef.current = unlock

  useLayoutEffect(() => {
    if (mode !== 'full') return
    resetSceneState()

    const ctx = gsap.context(() => {
      const refs: TimelineRefs = {
        lines: lineEls.current,
        steps: stepEls.current,
        progress: progressFill.current,
        cue: cue.current,
        ui: ui.current,
        scrim: scrim.current,
      }

      const tl = buildMasterTimeline(refs)
      tlRef.current = tl
      if (process.env.NODE_ENV !== 'production') Object.assign(window, { __tl: tl })

      // Completion is the only thing that unlocks the page. The scroll position
      // is never touched here, so the handoff is seamless.
      tl.eventCallback('onComplete', () => unlockRef.current())
      tl.play()
    }, root)

    return () => {
      tlRef.current?.kill()
      tlRef.current = null
      ctx.revert()
    }
  }, [mode])

  /**
   * The pin is created only once scrolling has been handed back.
   *
   * ScrollTrigger measures the document to set up a pin, and while the intro is
   * running the document is deliberately `overflow: hidden` with no scrollable
   * height — measuring against that collapses the pinned element to nothing.
   * Waiting until unlock also matches what the pin is actually for: holding the
   * finished product frame while the preserved section rises underneath it.
   */
  // Deliberately useEffect, not useLayoutEffect: this must run after the paint
  // in which the scroll lock was released, so the document it measures is the
  // scrollable one.
  useEffect(() => {
    if (mode !== 'full' || !finished || !root.current) return

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: root.current,
        start: 'top top',
        end: '+=85%',
        pin: true,
        pinSpacing: true,
        scrub: true,
        animation: gsap.timeline().to(root.current, { autoAlpha: 0, ease: 'none' }),
        onLeave: () => {
          if (root.current) root.current.style.visibility = 'hidden'
        },
        onEnterBack: () => {
          if (root.current) root.current.style.visibility = 'visible'
        },
      })
    }, root)

    ScrollTrigger.refresh()
    return () => ctx.revert()
  }, [mode, finished])

  const skip = useCallback(() => {
    const tl = tlRef.current
    if (tl) {
      // Jump to the end state exactly — same frame the sequence would have
      // reached on its own — then unlock.
      tl.progress(1, false)
    }
    unlock()
    // Skipping is the one case where the brief asks to land on the main
    // content, so the pinned intro is scrolled past rather than held.
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' })
    })
  }, [unlock])

  if (mode === 'pending') return null

  if (mode === 'reduced') return <ReducedMotionIntro onDone={unlock} />

  if (mode === 'fallback') {
    // No WebGL: the story is still told, as text, and the page unlocks at once.
    return (
      <div className={s.root}>
        <div className={s.fallback}>
          <p style={{ fontSize: 'var(--step-2)', fontWeight: 600, maxWidth: '20ch' }}>
            {INTRO_LINES[0].text}
          </p>
          <p style={{ color: 'var(--muted)', maxWidth: '46ch' }}>{INTRO_LINES[6].text}</p>
          <button className={s.skip} onClick={unlock} style={{ justifySelf: 'center' }}>
            Continue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={root} className={`${s.root} ${finished ? s.done : ''}`}>
      <div className={s.canvas}>
        <Stage />
      </div>

      <div className={s.progressTrack} ref={progressTrack} data-nudge="false" aria-hidden="true">
        <div className={s.progressFill} ref={progressFill} />
      </div>

      {/* Progress is also announced non-visually, without being a live region
          that chatters every frame. */}
      <p className="sr-only" role="status">
        Introduction playing. Use the skip introduction button to continue.
      </p>

      <div className={s.scrim} ref={scrim} aria-hidden="true" />

      <div className={s.ui} ref={ui}>
        <div className={s.topRow}>
          <span className={s.mark}>Wipely</span>
          <button className={s.skip} onClick={skip} type="button">
            {SKIP_LABEL}
          </button>
        </div>

        <div className={s.copy}>
          {INTRO_LINES.map((l) => (
            <p
              key={l.id}
              className={`${s.line} ${l.sub ? s.sub : ''}`}
              ref={(el) => {
                lineEls.current[l.id] = el
              }}
            >
              {l.text}
            </p>
          ))}
        </div>

        <ol className={s.steps}>
          {INTRO_STEPS.map((step, i) => (
            <li
              key={step.text}
              className={s.step}
              ref={(el) => {
                stepEls.current[i] = el
              }}
            >
              <span className={s.stepNum}>{String(i + 1).padStart(2, '0')}</span>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>

        <div className={s.cue} ref={cue}>
          <span className={s.cueArrow} />
          {SCROLL_CUE}
        </div>
      </div>
    </div>
  )
}
