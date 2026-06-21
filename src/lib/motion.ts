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

/** Rotate the card's inner face. The flip is the one moment of delight. */
export function flip(inner: HTMLElement, showBack: boolean): void {
  const rotateY = showBack ? 180 : 0
  if (prefersReduced()) {
    gsap.set(inner, { rotateY })
    return
  }
  gsap.to(inner, { rotateY, duration: seconds('--dur-flip', 0.42), ease: 'back.out(1.4)' })
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

/** Wrong-answer shake. */
export function shake(node: HTMLElement): void {
  if (prefersReduced()) return
  gsap.fromTo(node, { x: -7 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' })
}

/** Right-answer confirm pop. */
export function pop(node: HTMLElement): void {
  if (prefersReduced()) return
  gsap.fromTo(node, { scale: 0.94 }, { scale: 1, duration: 0.35, ease: 'back.out(2.2)' })
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

/** Stagger items up into place (cards, rows, options). */
export function fadeUp(nodes: Element[] | Element, opts: { stagger?: number; y?: number } = {}): void {
  const arr = Array.isArray(nodes) ? nodes : [nodes]
  if (!arr.length) return
  if (prefersReduced()) {
    gsap.set(arr, { autoAlpha: 1, y: 0 })
    return
  }
  gsap.fromTo(
    arr,
    { autoAlpha: 0, y: opts.y ?? 10 },
    { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out', stagger: opts.stagger ?? 0.06, clearProps: 'transform' },
  )
}
