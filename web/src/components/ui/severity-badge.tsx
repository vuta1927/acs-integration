import { OctagonAlert, TriangleAlert, CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Severity } from '@/lib/types'

const CONFIGS = {
  0: { label: 'CRITICAL', Icon: OctagonAlert, cls: 'bg-cr-critical text-cr-bg border-cr-critical' },
  1: { label: 'MAJOR',    Icon: TriangleAlert, cls: 'bg-cr-major/15 text-cr-major border-cr-major/40' },
  2: { label: 'MINOR',    Icon: CircleAlert,   cls: 'bg-cr-minor/15 text-cr-minor border-cr-minor/40' },
} as const

interface SeverityBadgeProps {
  level: Severity
  className?: string
}

export function SeverityBadge({ level, className }: SeverityBadgeProps) {
  const { label, Icon, cls } = CONFIGS[level] ?? CONFIGS[1]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-control border px-1.5 py-0.5',
        'font-mono text-2xs font-semibold',
        cls,
        className,
      )}
    >
      <Icon size={12} strokeWidth={1.75} aria-hidden />
      {label}
    </span>
  )
}
