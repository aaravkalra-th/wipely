'use client'

import { useEffect, useState } from 'react'
import s from './intro.module.css'
import { REDUCED_STATES, SKIP_LABEL } from '@/content/copy'

/**
 * The reduced-motion introduction.
 *
 * Same story, told as four labelled states that cross-dissolve. No camera
 * travel, no scaling, no WebGL, no scroll lock beyond the four seconds it takes
 * to read, and Lenis is never started. Every word here is also present in the
 * main document below, so nothing is only available through animation.
 */
export function ReducedMotionIntro({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    // Under four seconds end to end, and dismissable at any point.
    const timers = [
      setTimeout(() => setStep(1), 900),
      setTimeout(() => setStep(2), 1800),
      setTimeout(() => setStep(3), 2700),
      setTimeout(() => onDone(), 3600),
    ]
    return () => timers.forEach(clearTimeout)
  }, [onDone])

  return (
    <div className={s.root} role="region" aria-label="Introduction">
      <div className={s.ui} style={{ pointerEvents: 'auto' }}>
        <div className={s.topRow}>
          <span className={s.mark}>Wipely</span>
          <button className={s.skip} onClick={onDone}>
            {SKIP_LABEL}
          </button>
        </div>

        <ol
          style={{
            alignSelf: 'center',
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gap: 22,
            maxWidth: '52ch',
          }}
        >
          {REDUCED_STATES.map((state, i) => (
            <li
              key={state.label}
              style={{
                opacity: i <= step ? 1 : 0.18,
                transition: 'opacity .4s ease',
              }}
            >
              <div
                style={{
                  fontSize: 'var(--step--1)',
                  color: 'var(--muted)',
                  letterSpacing: '.04em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                {state.label}
              </div>
              <p style={{ fontSize: 'var(--step-1)', fontWeight: 500, lineHeight: 1.25 }}>
                {state.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
