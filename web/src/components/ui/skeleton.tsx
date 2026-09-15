import { cn } from '@/lib/utils'

/**
 * A loading placeholder that holds the height of the content it stands in for, so
 * nothing on the page jumps when the data lands.
 */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn('skl', className)} style={style} />
}

/** Rows shaped like the table they are standing in for. */
export function SkeletonRows({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="border-t border-line-soft px-3.5 py-3">
              <Skeleton
                className="h-[11px]"
                style={{ width: `${[58, 92, 120, 82, 60][c % 5]}px`, animationDelay: `${r * 60 + c * 30}ms` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
