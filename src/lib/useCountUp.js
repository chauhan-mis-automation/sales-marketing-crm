import { useState, useEffect, useRef } from 'react'

// Smoothly animates a number from 0 (or its previous value) up to `target`
// over `duration` ms — used for the summary stat cards.
export function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0)
  const rafRef = useRef(null)
  const startRef = useRef(null)
  const fromRef = useRef(0)

  useEffect(() => {
    fromRef.current = value
    startRef.current = null

    function step(ts) {
      if (startRef.current === null) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = fromRef.current + (target - fromRef.current) * eased
      setValue(next)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        setValue(target)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => rafRef.current && cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration])

  return value
}
