'use client'

import { useState } from 'react'
import { IntroSequence } from '@/components/intro/IntroSequence'
import { PreservedHero } from '@/components/preserved/PreservedHero'
import { MainSections } from '@/components/sections/MainSections'

/**
 * Page order:
 *   1. the cinematic introduction, pinned and scroll-locked until it completes
 *   2. the preserved Wipely viewer, unchanged
 *   3. the eight main sections
 *
 * The main document is rendered from the first paint and simply sits beneath
 * the introduction overlay. Nothing is mounted or scrolled at the moment of
 * unlock, so the handoff cannot jump.
 */
export default function Page() {
  const [unlocked, setUnlocked] = useState(false)

  return (
    <>
      <IntroSequence onUnlock={() => setUnlocked(true)} />
      <main
        id="main"
        // Hidden from assistive tech only while the overlay owns the screen.
        aria-hidden={!unlocked}
      >
        <PreservedHero />
        <MainSections />
      </main>
    </>
  )
}
