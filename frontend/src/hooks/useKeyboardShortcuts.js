/**
 * hooks/useKeyboardShortcuts.js
 * Keyboard navigation for the pipeline stack-ranked view.
 * Per docs/design/pages/03_position_detail.md §7.
 *
 * Usage:
 *   useKeyboardShortcuts({
 *     enabled: true,
 *     candidates: [...],
 *     focusedIndex,
 *     setFocusedIndex,
 *     onEmail, onSchedule, onReject, onMove, onOpen,
 *   })
 */
import { useEffect, useCallback } from 'react'

export default function useKeyboardShortcuts({
  enabled = false,
  candidates = [],
  focusedIndex,
  setFocusedIndex,
  onEmail,
  onSchedule,
  onReject,
  onMove,
  onOpen,
  onShowHelp,
}) {
  const handler = useCallback((e) => {
    if (!enabled || candidates.length === 0) return

    // Skip if user is typing in an input/textarea/select
    const tag = e.target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

    const candidate = candidates[focusedIndex]

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex(Math.max(0, focusedIndex - 1))
        break
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex(Math.min(candidates.length - 1, focusedIndex + 1))
        break
      case 'ArrowRight':
        e.preventDefault()
        if (candidate && onOpen) onOpen(candidate)
        break
      case 'e':
      case 'E':
        e.preventDefault()
        if (candidate && onEmail) onEmail(candidate)
        break
      case 'i':
      case 'I':
        e.preventDefault()
        if (candidate && onSchedule) onSchedule(candidate)
        break
      case 'r':
      case 'R':
        e.preventDefault()
        if (candidate && onReject) onReject(candidate)
        break
      case 'm':
      case 'M':
        e.preventDefault()
        if (candidate && onMove) onMove(candidate)
        break
      case '?':
        e.preventDefault()
        if (onShowHelp) onShowHelp()
        break
      default:
        break
    }
  }, [enabled, candidates, focusedIndex, setFocusedIndex, onEmail, onSchedule, onReject, onMove, onOpen, onShowHelp])

  useEffect(() => {
    if (!enabled) return
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, handler])
}
