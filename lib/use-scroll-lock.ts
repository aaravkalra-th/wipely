'use client'

import { useEffect } from 'react'

const SCROLL_KEYS = new Set([
  ' ',
  'Spacebar',
  'PageDown',
  'PageUp',
  'End',
  'Home',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
])

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/**
 * Locks page scrolling without trapping keyboard focus.
 *
 * Wheel, trackpad, touch, spacebar, Page Up/Down, Home/End and the arrow keys
 * are all prevented from moving the page. Tab still moves focus, so the header,
 * the skip-introduction control and the skip-to-content link stay operable.
 *
 * `onAttempt` fires when the user tries to scroll, so the caller can reinforce
 * the progress indicator instead of shaking the viewport.
 */
export function useScrollLock(locked: boolean, onAttempt?: () => void) {
  useEffect(() => {
    if (!locked) {
      document.documentElement.classList.remove('is-locked')
      return
    }

    document.documentElement.classList.add('is-locked')

    // Anything mid-flight from before the lock would otherwise land later.
    window.scrollTo(0, 0)

    const notify = () => onAttempt?.()

    const block = (e: Event) => {
      e.preventDefault()
      notify()
    }

    const onKey = (e: KeyboardEvent) => {
      // Never intercept typing, and never intercept Tab: focus must stay free.
      if (isTypingTarget(e.target) || e.key === 'Tab') return
      if (!SCROLL_KEYS.has(e.key)) return
      e.preventDefault()
      notify()
    }

    const opts: AddEventListenerOptions = { passive: false }
    window.addEventListener('wheel', block, opts)
    window.addEventListener('touchmove', block, opts)
    window.addEventListener('keydown', onKey, opts)

    return () => {
      window.removeEventListener('wheel', block, opts)
      window.removeEventListener('touchmove', block, opts)
      window.removeEventListener('keydown', onKey, opts)
      document.documentElement.classList.remove('is-locked')
    }
  }, [locked, onAttempt])
}
