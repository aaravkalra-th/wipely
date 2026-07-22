'use client'

import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import s from './sections.module.css'
import { SECTIONS, PRODUCT_NAME, APPROVAL_NOTES, ATTRIBUTIONS } from '@/content/copy'
import { HowItWorksFigure } from './HowItWorksFigure'

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger)

/** Renders a value, and marks it plainly when it has not been approved yet. */
function Value({ children }: { children: string }) {
  if (children.startsWith('PENDING')) {
    return (
      <span className={s.pending}>
        <span className={s.pendingTag}>Pending</span>
        {children.replace(/^PENDING\s*—\s*/, '')}
      </span>
    )
  }
  return <>{children}</>
}

function Eyebrow({ children }: { children: string }) {
  return <div className={s.eyebrow}>{children}</div>
}

export function MainSections() {
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // One reveal treatment, applied once. Headings are not each given their
      // own bespoke entrance.
      gsap.utils.toArray<HTMLElement>(`.${s.reveal}`).forEach((el) => {
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        })
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={root}>
      {/* 1 — the problem */}
      <section className={s.section} id="problem">
        <div className={s.reveal}>
          <Eyebrow>{SECTIONS.problem.eyebrow}</Eyebrow>
          <h2 className={s.h}>{SECTIONS.problem.heading}</h2>
          <div className={s.lead}>
            {SECTIONS.problem.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      {/* 2 — the solution */}
      <div className={s.alt}>
        <section className={`${s.section} ${s.altInner}`} id="solution">
          <div className={`${s.two} ${s.reveal}`}>
            <div>
              <Eyebrow>{SECTIONS.solution.eyebrow}</Eyebrow>
              <h2 className={s.h}>{SECTIONS.solution.heading}</h2>
            </div>
            <div className={s.lead} style={{ marginTop: 0 }}>
              <p>{SECTIONS.solution.body}</p>
            </div>
          </div>
        </section>
      </div>

      {/* 3 — how it works, three steps, scroll-linked figure */}
      <section className={s.section} id="how">
        <div className={s.reveal}>
          <Eyebrow>{SECTIONS.how.eyebrow}</Eyebrow>
          <h2 className={s.h}>{SECTIONS.how.heading}</h2>
        </div>
        <HowItWorksFigure />
        <div className={s.steps}>
          {SECTIONS.how.steps.map((step) => (
            <div key={step.n} className={s.step}>
              <span className={s.stepN}>{step.n}</span>
              <span className={s.stepT}>{step.title}</span>
              <span className={s.stepB}>{step.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 4 — product details */}
      <div className={s.alt}>
        <section className={`${s.section} ${s.altInner}`} id="details">
          <div className={s.reveal}>
            <Eyebrow>{SECTIONS.details.eyebrow}</Eyebrow>
            <h2 className={s.h}>{SECTIONS.details.heading}</h2>
          </div>
          <div className={s.rows}>
            {SECTIONS.details.rows.map((r) => (
              <div className={s.row} key={r.k}>
                <div className={s.k}>{r.k}</div>
                <div className={s.v}>
                  <Value>{r.v}</Value>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 5 — why it is different */}
      <section className={s.section} id="different">
        <div className={s.reveal}>
          <Eyebrow>{SECTIONS.different.eyebrow}</Eyebrow>
          <h2 className={s.h}>{SECTIONS.different.heading}</h2>
          <p className={s.notice}>{SECTIONS.different.note.replace(/^PENDING\s*—\s*/, '')}</p>
        </div>
        <div className={s.rows}>
          {SECTIONS.different.rows.map((r) => (
            <div className={s.row} key={r.k}>
              <div className={s.k}>{r.k}</div>
              <div className={s.v}>
                <Value>{r.v}</Value>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6 — daily use */}
      <div className={s.alt}>
        <section className={`${s.section} ${s.altInner}`} id="daily">
          <div className={s.reveal}>
            <Eyebrow>{SECTIONS.daily.eyebrow}</Eyebrow>
            <h2 className={s.h}>{SECTIONS.daily.heading}</h2>
            <div className={s.lead}>
              <p>{SECTIONS.daily.body}</p>
            </div>
          </div>
          <div className={s.places}>
            {[
              ['On a desk', 'Flat against the phone, so it does not become another object on the table.'],
              ['In an entryway', 'Arrives with the phone rather than waiting in a drawer.'],
              ['On a nightstand', 'Thin enough that the phone still lies flat.'],
              ['In a pocket', 'About as thick as a card, on the back of the case.'],
            ].map(([t, b]) => (
              <div className={s.place} key={t}>
                <span className={s.placeT}>{t}</span>
                <span className={s.placeB}>{b}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 7 — FAQ */}
      <section className={s.section} id="faq">
        <div className={s.reveal}>
          <Eyebrow>{SECTIONS.faq.eyebrow}</Eyebrow>
          <h2 className={s.h}>{SECTIONS.faq.heading}</h2>
        </div>
        <div className={s.faq}>
          {SECTIONS.faq.items.map((item) => (
            <details className={s.q} key={item.q}>
              <summary>{item.q}</summary>
              <div className={s.a}>
                <Value>{item.a}</Value>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* 8 — final call to action */}
      <section className={s.cta} id="buy">
        <h2 className={`${s.ctaH} ${s.reveal}`}>{SECTIONS.cta.heading}</h2>
        <div className={`${s.ctaRow} ${s.reveal}`}>
          <a className={s.primary} href="#buy">
            {SECTIONS.cta.primary}
          </a>
          <a className={s.secondary} href="#how">
            {SECTIONS.cta.secondary}
          </a>
        </div>
      </section>

      {/* Visible only to whoever is reviewing copy. Not decorative. */}
      <footer
        className={s.section}
        style={{ paddingTop: 0, color: 'var(--muted)', fontSize: 'var(--step--1)' }}
      >
        {/* CC-BY requires this credit to be visible wherever the asset ships. */}
        <p style={{ marginBottom: 18, lineHeight: 1.6 }}>
          {ATTRIBUTIONS.map((a, i) => (
            <span key={a.what}>
              {i > 0 && ' · '}
              {a.what}:{' '}
              <a href={a.href} target="_blank" rel="noopener noreferrer">
                {a.who}
              </a>{' '}
              ({a.licence})
            </span>
          ))}
        </p>
        <details>
          <summary style={{ cursor: 'pointer' }}>Copy approval notes ({PRODUCT_NAME})</summary>
          <ul style={{ lineHeight: 1.6, maxWidth: 'var(--measure)' }}>
            {APPROVAL_NOTES.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      </footer>
    </div>
  )
}
