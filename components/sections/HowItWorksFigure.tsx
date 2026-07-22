'use client'

import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import s from './sections.module.css'

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger)

/**
 * The mechanism, drawn.
 *
 * A scroll-scrubbed side elevation rather than a second WebGL context: the pad
 * on the back of the phone, a sheet drawn out of the pocket, and the wipe
 * itself. Three beats, matching the three written steps, and nothing else.
 *
 * This is the scrubbed half of the ScrollTrigger work — the introduction uses
 * pin, labels and callbacks; this uses pin and scrub.
 */
export function HowItWorksFigure() {
  const wrap = useRef<HTMLDivElement>(null)
  const sheet = useRef<SVGPathElement>(null)
  const pad = useRef<SVGGElement>(null)
  const wipe = useRef<SVGRectElement>(null)
  const glow = useRef<SVGRectElement>(null)

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrap.current,
          start: 'top 78%',
          end: 'bottom 55%',
          scrub: 0.6,
        },
      })

      // 01 — the pad settles onto the back of the phone
      tl.fromTo(pad.current, { y: -18, opacity: 0 }, { y: 0, opacity: 1, ease: 'power2.out' }, 0)

      // 02 — a sheet is drawn out of the pocket
      tl.fromTo(
        sheet.current,
        { attr: { d: 'M 196 128 C 196 128 196 128 196 128' }, opacity: 0 },
        {
          attr: { d: 'M 196 128 C 208 96 214 74 206 56' },
          opacity: 1,
          ease: 'none',
        },
        0.6
      )

      // 03 — the wipe crosses the screen, and the smudge layer clears with it
      tl.fromTo(wipe.current, { x: -74, opacity: 0 }, { x: 0, opacity: 1, ease: 'none' }, 1.4)
      tl.to(wipe.current, { x: 62, ease: 'none' }, 1.7)
      tl.to(glow.current, { opacity: 0, ease: 'none' }, 1.7)
      tl.to(wipe.current, { opacity: 0, duration: 0.3 }, 2.3)
    }, wrap)

    return () => ctx.revert()
  }, [])

  return (
    <div className={s.figure} ref={wrap} style={{ marginTop: 'clamp(34px,6vh,66px)' }}>
      <svg viewBox="0 0 420 320" width="100%" height="100%" role="img" aria-label="Peel a sheet from the pad on the back of the phone, then wipe the screen.">
        {/* phone, side-on-front three-quarter simplification */}
        <rect
          x="120"
          y="60"
          width="150"
          height="210"
          rx="22"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1.5"
          opacity="0.85"
        />
        {/* screen */}
        <rect x="130" y="70" width="130" height="190" rx="15" fill="var(--surface)" />
        {/* the smudge layer that the wipe clears */}
        <rect
          ref={glow}
          x="130"
          y="70"
          width="130"
          height="190"
          rx="15"
          fill="var(--contam)"
          opacity="0.17"
        />
        {/* the wipe itself */}
        <rect
          ref={wipe}
          x="150"
          y="76"
          width="66"
          height="178"
          rx="10"
          fill="#fff"
          stroke="var(--line)"
          strokeWidth="1"
          opacity="0"
        />

        {/* the pad, mounted behind, seen edge-on at the right */}
        <g ref={pad}>
          <rect
            x="276"
            y="104"
            width="16"
            height="126"
            rx="7"
            fill="var(--accent)"
            opacity="0.16"
            stroke="var(--accent)"
            strokeWidth="1.2"
          />
          <line
            x1="270"
            y1="118"
            x2="270"
            y2="216"
            stroke="var(--ink)"
            strokeWidth="1.2"
            opacity="0.5"
          />
        </g>

        {/* the drawn sheet */}
        <path
          ref={sheet}
          d="M 196 128 C 196 128 196 128 196 128"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0"
          transform="translate(88 0)"
        />
      </svg>
    </div>
  )
}
