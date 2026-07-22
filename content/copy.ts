/**
 * SINGLE SOURCE OF TRUTH FOR ALL USER-FACING COPY.
 *
 * Nothing in this project hardcodes a sentence anywhere else. Review this one
 * file and the whole site is reviewed.
 *
 * `status` on each block is either:
 *   'approved'  — supplied verbatim in the brief, safe to ship.
 *   'mechanism' — written here, but describes only a physical action the user
 *                 performs or an observable property of the object. Contains no
 *                 health, sanitation, efficacy or performance claim. Still needs
 *                 a sign-off, but carries no regulatory risk.
 *   'PENDING'   — placeholder. Real content was never supplied. MUST be replaced
 *                 before launch. Run `npm run copy:pending` to list every one.
 *
 * Hard rule observed throughout: no claim is made about germs being killed,
 * reduced, or neutralised, and no statistic appears that was not supplied.
 */

export type CopyStatus = 'approved' | 'mechanism' | 'PENDING'

export const PRODUCT_NAME = 'Wipely'

/* ------------------------------------------------------------------ */
/*  INTRODUCTION — the cinematic sequence                              */
/* ------------------------------------------------------------------ */

export interface IntroLine {
  id: string
  text: string
  /** master-timeline seconds */
  in: number
  out: number
  status: CopyStatus
  /** rendered smaller, directly under the line above it */
  sub?: boolean
}

export const INTRO_LINES: IntroLine[] = [
  // Scene 1 — returning home. Supplied verbatim.
  { id: 'l1', text: 'You bring more home than you realize.', in: 0.9, out: 3.0, status: 'approved' },

  // Scene 2 — contaminated hands. Supplied verbatim.
  {
    id: 'l2',
    text: 'Washing your hands removes what you picked up outside.',
    in: 3.5,
    out: 6.0,
    status: 'approved',
  },

  // Scene 3 — handwashing resolves. Supplied verbatim.
  { id: 'l3', text: 'Clean hands. Problem solved?', in: 9.5, out: 10.9, status: 'approved' },

  // Scene 4 — the phone. Both supplied verbatim.
  { id: 'l4', text: 'Then you touch your phone.', in: 11.3, out: 13.6, status: 'approved' },
  { id: 'l5', text: 'And put it all back.', in: 14.0, out: 15.4, status: 'approved' },

  // Scene 6 — product reveal.
  { id: 'l6', text: `Meet ${PRODUCT_NAME}.`, in: 16.0, out: 17.5, status: 'approved' },
  {
    id: 'l7',
    // Value proposition. Describes form factor and user action only.
    text: 'A flat pad of wipes that sticks to the back of your phone, so the thing you touch most is never far from a fresh sheet.',
    in: 18.6,
    out: 21.3,
    status: 'mechanism',
    sub: true,
  },
]

/**
 * Scene 7 — how it works, shown as three beats during the reveal.
 * Rewritten from the brief's enclosure example ("place your phone inside") to
 * match the actual product: a passive adhesive sheet dispenser.
 */
export const INTRO_STEPS: { text: string; status: CopyStatus }[] = [
  { text: 'Peel a sheet from the pad on your phone.', status: 'mechanism' },
  { text: 'Wipe the screen and the back.', status: 'mechanism' },
  { text: 'Start fresh without changing your routine.', status: 'approved' },
]

export const SCROLL_CUE = 'Scroll to explore'
export const SKIP_LABEL = 'Skip introduction'

/* ------------------------------------------------------------------ */
/*  REDUCED MOTION — the same story as four labelled states            */
/* ------------------------------------------------------------------ */

export const REDUCED_STATES = [
  { label: 'Outside', text: 'You pick things up on the way home.' },
  { label: 'Washed', text: 'Washing your hands removes what you picked up outside.' },
  { label: 'Phone', text: 'Then you touch your phone, and put it all back.' },
  { label: PRODUCT_NAME, text: INTRO_LINES[6].text },
]

/* ------------------------------------------------------------------ */
/*  MAIN PAGE                                                          */
/* ------------------------------------------------------------------ */

export const SECTIONS = {
  problem: {
    eyebrow: 'The problem',
    heading: 'Clean hands meet an unwashed object.',
    body: [
      'Handwashing is a routine with an end point. You finish, you dry your hands, and you reach for the object you have been carrying all day.',
      'A phone does not go through that routine. It goes from a pocket to a table to a hand, and it is held against the face, and it is rarely cleaned on any schedule at all.',
    ],
    status: 'mechanism' as CopyStatus,
    // The preserved hero carries a "25x dirtier than a toilet seat" figure.
    // It is kept verbatim per instruction, but it is unsourced — see NOTES below.
    citationNeeded: true,
  },

  solution: {
    eyebrow: 'The solution',
    heading: `${PRODUCT_NAME} keeps the wipe where the problem is.`,
    body: 'A slim adhesive pad of sheets that mounts flat to the back of a phone or case, about as thick as a card. Peel one sheet, wipe the surfaces you touch, and the pad stays where it is.',
    status: 'mechanism' as CopyStatus,
  },

  how: {
    eyebrow: 'How it works',
    heading: 'Three steps. No routine to remember.',
    steps: [
      { n: '01', title: 'Stick it on', text: 'The adhesive back mounts flush to the phone or case and sits flat in a pocket.' },
      { n: '02', title: 'Peel a sheet', text: 'Sheets sit in a pocket behind a scooped opening and come out one at a time.' },
      { n: '03', title: 'Wipe and carry on', text: 'Wipe the screen and the back. The pad stays put for the next one.' },
    ],
    status: 'mechanism' as CopyStatus,
  },

  details: {
    eyebrow: 'Product details',
    heading: 'What you get.',
    /**
     * PENDING — no product sheet was supplied. Every value below is a
     * placeholder. Do not publish.
     */
    status: 'PENDING' as CopyStatus,
    rows: [
      { k: 'Sheet count', v: 'Ultra-Slim / Standard / Moisture-Lock' },
      { k: 'Materials', v: 'PENDING — supply shell and sheet material' },
      { k: 'Dimensions', v: 'PENDING — supply W x H x D per variant' },
      { k: 'Compatibility', v: 'PENDING — confirm case and MagSafe compatibility' },
      { k: 'Controls', v: 'None. The product is passive.' },
      { k: 'Power', v: 'None required.' },
      { k: 'In the box', v: 'PENDING — supply included items' },
    ],
  },

  different: {
    eyebrow: 'Why it is different',
    heading: 'Compared honestly.',
    status: 'PENDING' as CopyStatus,
    // Comparison claims must be verifiable. Structure only — no claims made.
    note: 'PENDING — supply verified comparison data before this section ships. No superiority claim is rendered until then.',
    rows: [
      { k: 'Loose wipe packet', v: 'PENDING' },
      { k: 'Spray and cloth', v: 'PENDING' },
      { k: PRODUCT_NAME, v: 'PENDING' },
    ],
  },

  daily: {
    eyebrow: 'Daily use',
    heading: 'Where it lives.',
    body: 'Flat enough for a back pocket, a desk, an entryway tray, or a nightstand. It travels on the phone, so it is there when you think of it.',
    status: 'mechanism' as CopyStatus,
  },

  faq: {
    eyebrow: 'FAQ',
    heading: 'Questions.',
    status: 'PENDING' as CopyStatus,
    items: [
      { q: 'Will it fit my case?', a: 'PENDING — supply compatibility list.' },
      { q: 'How do I clean the pad itself?', a: 'PENDING — supply care instructions.' },
      { q: 'Is it safe on screen coatings?', a: 'PENDING — supply material safety guidance. Do not publish an unverified answer.' },
      { q: 'How many sheets are in a pad?', a: 'PENDING — supply per-variant sheet counts.' },
      { q: 'What is the warranty?', a: 'PENDING — supply warranty terms.' },
      { q: 'How does shipping work?', a: 'PENDING — supply shipping regions, cost and timelines.' },
    ],
  },

  cta: {
    heading: 'Clean that sticks with you.',
    primary: 'Buy Wipely',
    secondary: 'See how it works',
    status: 'approved' as CopyStatus, // heading is the preserved brand line
  },
} as const

/* ------------------------------------------------------------------ */
/*  THIRD-PARTY ASSET ATTRIBUTION                                      */
/* ------------------------------------------------------------------ */

/**
 * Rendered in the page footer. The hand model is CC-BY: crediting the author
 * is a condition of the licence, not a courtesy, so this is not optional and
 * must not be removed while that asset ships.
 */
export const ATTRIBUTIONS = [
  {
    what: 'Hand model',
    who: 'ronildo.facanha',
    licence: 'CC BY 4.0',
    href: 'https://sketchfab.com/3d-models/low-poly-hand-3d-model-19c9ac5c369a468a95f081a3cc2ad4ac',
    required: true,
  },
  {
    what: 'Character model',
    who: 'Quaternius',
    licence: 'CC0 1.0 (public domain)',
    href: 'https://quaternius.com/',
    required: false,
  },
] as const

/* ------------------------------------------------------------------ */
/*  NOTES FOR WHOEVER APPROVES THIS FILE                               */
/* ------------------------------------------------------------------ */

export const APPROVAL_NOTES = [
  'The preserved hero states "25x dirtier than a toilet seat". That figure was in the original design and is kept verbatim as instructed, but it has no citation in this repo. It needs a source or removal before launch.',
  'No copy anywhere in this project claims the product kills, reduces, or neutralises anything. All product copy describes form factor and user action only.',
  'Sections "Product details", "Why it is different" and "FAQ" are structurally complete but contain PENDING placeholders. They render, but must not ship.',
]
