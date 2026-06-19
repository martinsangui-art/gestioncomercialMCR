import { useState, useEffect, useRef } from 'react'

// Anima un número contando desde 0 hasta el valor final
export function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0)
  const startRef = useRef(null)
  const fromRef = useRef(0)

  useEffect(() => {
    if (typeof target !== 'number' || isNaN(target)) { setValue(target); return }
    fromRef.current = value
    startRef.current = null
    let raf

    function step(ts) {
      if (!startRef.current) startRef.current = ts
      const elapsed = ts - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = fromRef.current + (target - fromRef.current) * eased
      setValue(target % 1 === 0 ? Math.round(current) : Math.round(current * 10) / 10)
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => raf && cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}
