'use client'

import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

let instance: Lenis | null = null

/**
 * Restrained smooth scroll, started only after the introduction unlocks.
 *
 * Tuning notes: `lerp` is high (0.16) and `duration` unset on purpose. Lower
 * values are what make smooth-scroll libraries feel slippery and detached from
 * the input device. This is close enough to native that the WebGL and DOM stay
 * visually locked together, which is the only reason it is here.
 *
 * Lenis is driven off GSAP's ticker rather than its own RAF, so scroll position,
 * ScrollTrigger and the R3F render loop all advance on the same frame.
 */
export function startLenis(): Lenis | null {
  if (instance) return instance
  if (typeof window === 'undefined') return null
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null

  instance = new Lenis({
    lerp: 0.16,
    wheelMultiplier: 1,
    touchMultiplier: 1.6,
    // Native inertial scrolling on touch already feels correct; overriding it
    // is what makes phones feel laggy.
    syncTouch: false,
  })

  instance.on('scroll', ScrollTrigger.update)

  if (process.env.NODE_ENV !== 'production') {
    Object.assign(window, { __lenis: instance, __ScrollTrigger: ScrollTrigger })
  }

  const raf = (time: number) => instance?.raf(time * 1000)
  gsap.ticker.add(raf)
  gsap.ticker.lagSmoothing(0)

  // Remember how to detach when stopping.
  cleanup = () => {
    gsap.ticker.remove(raf)
    instance?.destroy()
    instance = null
  }

  return instance
}

let cleanup: (() => void) | null = null

export function stopLenis() {
  cleanup?.()
  cleanup = null
}

export function getLenis() {
  return instance
}
