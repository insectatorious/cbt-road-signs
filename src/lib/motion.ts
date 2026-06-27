/** All GSAP motion lives here, behind one reduced-motion guard. Subtle and
 *  functional (Rams: "unobtrusive"). When the user prefers reduced motion,
 *  every helper applies the final state instantly — no rotation, no shake. */
import { gsap } from 'gsap'

export function prefersReduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function seconds(varName: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  if (v.endsWith('ms')) return parseFloat(v) / 1000 || fallback
  if (v.endsWith('s')) return parseFloat(v) || fallback
  return fallback
}

/** Reveal the answer by expanding it open below the (always-visible) sign.
 *  Replaces the old card flip: the sign never moves, so the learner can
 *  verify their recall against the artwork while they grade it. */
export function revealAnswer(panel: HTMLElement): void {
  if (prefersReduced()) {
    gsap.set(panel, { height: 'auto', autoAlpha: 1 })
    return
  }
  gsap.set(panel, { height: 'auto', autoAlpha: 1 })
  gsap.from(panel, {
    height: 0,
    autoAlpha: 0,
    duration: seconds('--dur-flip', 0.42),
    ease: 'power3.out',
    clearProps: 'height',
    onStart: () => {
      panel.style.overflow = 'hidden'
    },
    onComplete: () => {
      panel.style.overflow = ''
    },
  })
}

/** Card leaves in the direction of meaning (Again → left, Easy → right). */
export function gradeExit(card: HTMLElement, dir: number, onDone: () => void): void {
  if (prefersReduced()) {
    onDone()
    return
  }
  gsap.to(card, {
    x: dir * 64,
    autoAlpha: 0,
    rotateZ: dir * 2.5,
    duration: seconds('--dur-base', 0.22),
    ease: 'power2.in',
    onComplete: onDone,
  })
}

export function enterCard(card: HTMLElement): void {
  if (prefersReduced()) {
    gsap.set(card, { clearProps: 'all' })
    return
  }
  gsap.fromTo(
    card,
    { x: 28, autoAlpha: 0 },
    { x: 0, autoAlpha: 1, duration: seconds('--dur-base', 0.22), ease: 'power2.out', clearProps: 'transform' },
  )
}

/** Wrong-answer shake. A quick, damped horizontal nudge that signals "not
 *  quite" and settles — functional feedback, not a spring (Sumanas: no bounce). */
export function shake(node: HTMLElement): void {
  if (prefersReduced()) return
  gsap.to(node, { duration: 0.36, ease: 'power2.out', keyframes: { x: [0, -6, 4, -2, 0] } })
}

/** Right-answer confirm pop. A calm settle into place — no overshoot. */
export function pop(node: HTMLElement): void {
  if (prefersReduced()) return
  gsap.fromTo(node, { scale: 0.96 }, { scale: 1, duration: 0.28, ease: 'power2.out' })
}

/** Animate a number from 0 → value, formatting each frame. */
export function countUp(
  node: HTMLElement,
  to: number,
  format: (n: number) => string,
  duration = 0.7,
): void {
  if (prefersReduced()) {
    node.textContent = format(to)
    return
  }
  const obj = { v: 0 }
  gsap.to(obj, {
    v: to,
    duration,
    ease: 'power2.out',
    onUpdate: () => {
      node.textContent = format(obj.v)
    },
  })
}

/** Grow bars from their left edge (performance bars, category meters). */
export function drawBars(nodes: Element[], stagger = 0.05): void {
  if (!nodes.length) return
  if (prefersReduced()) {
    gsap.set(nodes, { scaleX: 1 })
    return
  }
  gsap.fromTo(
    nodes,
    { scaleX: 0 },
    { scaleX: 1, transformOrigin: 'left center', duration: 0.55, ease: 'power2.out', stagger },
  )
}

/** Stagger items up into place (cards, rows, options). `delay` lets a panel wait
 *  for a preceding beat (e.g. the wrong-answer shake) to settle first. */
export function fadeUp(
  nodes: Element[] | Element,
  opts: { stagger?: number; y?: number; delay?: number } = {},
): void {
  const arr = Array.isArray(nodes) ? nodes : [nodes]
  if (!arr.length) return
  if (prefersReduced()) {
    gsap.set(arr, { autoAlpha: 1, y: 0 })
    return
  }
  gsap.fromTo(
    arr,
    { autoAlpha: 0, y: opts.y ?? 10 },
    {
      autoAlpha: 1,
      y: 0,
      duration: 0.4,
      ease: 'power2.out',
      delay: opts.delay ?? 0,
      stagger: opts.stagger ?? 0.06,
      clearProps: 'transform',
    },
  )
}
