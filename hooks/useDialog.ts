'use client'
import { useEffect, RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Stack of open dialogs — only the topmost reacts to keyboard events, so
 * nested surfaces (e.g. the IPTV player inside the Vault) close one at a time.
 */
const dialogStack: Array<symbol> = []

/**
 * Accessibility behaviour for modal surfaces:
 * - Escape closes the topmost dialog
 * - focus moves into the dialog on open and is restored on close
 * - Tab / Shift+Tab cycle within the dialog
 */
export function useDialog(
  open: boolean,
  onClose: () => void,
  containerRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) return

    const token = Symbol('dialog')
    dialogStack.push(token)

    const previouslyFocused = document.activeElement as HTMLElement | null
    const container = containerRef.current

    const focusTimer = window.setTimeout(() => {
      const target = container?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? container
      target?.focus()
    }, 0)

    const isTopmost = () => dialogStack[dialogStack.length - 1] === token

    function onKeyDown(event: KeyboardEvent) {
      if (!isTopmost()) return

      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !container) return

      const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null,
      )
      if (items.length === 0) return

      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement

      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !container.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown, true)
      const index = dialogStack.indexOf(token)
      if (index !== -1) dialogStack.splice(index, 1)
      previouslyFocused?.focus?.()
    }
  }, [open, onClose, containerRef])
}
