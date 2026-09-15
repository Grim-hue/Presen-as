import { useCountUp } from '@/lib/motion'

/**
 * A number that counts up when it first appears.
 *
 * Tabular figures so the width does not jitter while the digits change, which is
 * what makes a counting number look broken rather than alive.
 */
export function Counter({
  value,
  decimals = 0,
  className,
  signed = false
}: {
  value: number
  decimals?: number
  className?: string
  signed?: boolean
}) {
  const current = useCountUp(value)
  const text = current.toFixed(decimals).replace('.', ',')
  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {signed && value > 0 ? '+' : ''}
      {text}
    </span>
  )
}
