import { usePrefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * A meter that grows from the left.
 *
 * Animates transform rather than width: a width animation asks the browser to lay
 * the page out again on every frame, a transform does not.
 */
export function Bar({
  fraction,
  colour,
  delay = 0,
  className
}: {
  fraction: number
  colour: string
  delay?: number
  className?: string
}) {
  const reduced = usePrefersReducedMotion()
  const width = `${Math.max(0, Math.min(1, fraction)) * 100}%`

  return (
    <div className={cn('h-[5px] overflow-hidden rounded-sm bg-elev', className)}>
      <div
        className={cn('h-full origin-left', !reduced && 'animate-grow')}
        style={{ width, background: colour, animationDelay: `${delay}ms` }}
      />
    </div>
  )
}
