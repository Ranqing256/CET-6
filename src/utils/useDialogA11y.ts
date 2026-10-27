import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

export function useDialogA11y(onClose: () => void) {
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const activeDialog = dialog
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const getFocusable = () => Array.from(activeDialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => element.getClientRects().length > 0)
    const initialTarget = activeDialog.querySelector<HTMLElement>('[autofocus]') ?? getFocusable()[0] ?? activeDialog
    initialTarget.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = getFocusable()
      if (!focusable.length) {
        event.preventDefault()
        activeDialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !activeDialog.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !activeDialog.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [])

  return dialogRef
}
