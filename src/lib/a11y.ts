/** Accessibility helpers for modal dialogs.
 *
 *  `modal` is a Svelte action applied to a dialog's root wrapper. It:
 *   - portals the node to <body> so it escapes the (about-to-be-inert) app subtree;
 *   - marks the rest of the app `inert` and locks body scroll while open;
 *   - traps Tab / Shift+Tab inside the dialog, cycling at the ends;
 *   - restores focus to the previously-focused trigger when the dialog closes.
 *  Escape-to-close and initial focus stay the dialog component's own concern. */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Visible, focusable elements within a container, in DOM order. */
export function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
  )
}

/** Pure: index to move focus to within `count` focusables, given the currently
 *  focused index (`-1` when focus is outside the trap) and whether Shift is held.
 *  Wraps at both ends; returns `-1` when there is nothing to focus. */
export function nextFocusIndex(count: number, current: number, shift: boolean): number {
  if (count <= 0) return -1
  if (current < 0) return shift ? count - 1 : 0
  return (current + (shift ? -1 : 1) + count) % count
}

export function modal(node: HTMLElement): { destroy(): void } {
  const body = document.body
  const appRoot = document.getElementById('app')
  const previouslyFocused = document.activeElement as HTMLElement | null
  const prevOverflow = body.style.overflow

  // Portal out of the app subtree *before* making that subtree inert, so the
  // dialog (and its backdrop) stay interactive while everything behind is not.
  body.appendChild(node)
  appRoot?.setAttribute('inert', '')
  body.style.overflow = 'hidden'

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return
    const items = focusableWithin(node)
    if (!items.length) {
      e.preventDefault()
      return
    }
    const current = items.indexOf(document.activeElement as HTMLElement)
    const atStart = current <= 0 && e.shiftKey
    const atEnd = current === items.length - 1 && !e.shiftKey
    // Only intercept at the boundaries (or when focus has escaped the dialog);
    // let the browser handle ordinary Tab moves between interior controls.
    if (current === -1 || atStart || atEnd) {
      e.preventDefault()
      items[nextFocusIndex(items.length, current, e.shiftKey)].focus()
    }
  }

  node.addEventListener('keydown', onKeydown)

  return {
    destroy() {
      node.removeEventListener('keydown', onKeydown)
      appRoot?.removeAttribute('inert')
      body.style.overflow = prevOverflow
      previouslyFocused?.focus?.()
      // Svelte removes the (now body-parented) node itself on unmount.
    },
  }
}
