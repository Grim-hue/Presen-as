import { useEffect, useRef, useState } from 'react'

/**
 * Whether the viewer has asked for less motion. Read live, because someone can
 * change it in the operating system while the page is open.
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  )
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/**
 * Counts from zero to [target] on an ease-out cubic.
 *
 * Driven by requestAnimationFrame rather than a timer, so it runs at the display's
 * refresh rate and stops when the tab is hidden instead of animating to nobody.
 * Anyone who asked for reduced motion gets the final value immediately.
 */
export function useCountUp(target: number, duration = 850) {
  const reduced = usePrefersReducedMotion()
  const [value, setValue] = useState(0)
  const from = useRef(0)

  useEffect(() => {
    if (reduced) {
      setValue(target)
      return
    }
    // Counting from wherever it currently is, so a value that changes mid-flight
    // moves smoothly rather than snapping back to zero.
    const start = from.current
    const startedAt = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = start + (target - start) * eased
      from.current = current
      setValue(current)
      if (t < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [target, duration, reduced])

  return value
}

/** Capped so a long table does not take five seconds to finish arriving. */
export function stagger(index: number, step = 45, max = 12) {
  return { animationDelay: `${Math.min(index, max) * step}ms` }
}
