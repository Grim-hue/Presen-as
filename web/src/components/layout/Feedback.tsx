import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Banner({ tone = 'warn', children }: { tone?: 'warn' | 'danger' | 'info'; children: ReactNode }) {
  const tones = {
    warn: 'border-warn-line bg-warn-bg text-warn',
    danger: 'border-danger-line bg-danger-bg text-danger',
    info: 'border-info-line bg-info-bg text-info'
  }
  return (
    <div className={cn('flex items-center gap-2.5 rounded border px-3.5 py-2.5 text-[12.5px]', tones[tone])}>
      <TriangleAlert size={16} strokeWidth={1.6} className="shrink-0" />
      <span>{children}</span>
    </div>
  )
}

/** Says what is missing and what to do, rather than only that nothing is here. */
export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-3.5 py-10 text-center">
      <div className="text-[13px] text-fg-muted">{title}</div>
      {hint && <div className="mt-1.5 text-xs text-fg-soft">{hint}</div>}
    </div>
  )
}
