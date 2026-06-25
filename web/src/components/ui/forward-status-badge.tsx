import { CircleCheck, CircleSlash, CircleX, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ForwardStatus } from '@/lib/types'

const CONFIGS: Record<ForwardStatus, { Icon: React.ElementType; cls: string }> = {
  Published: { Icon: CircleCheck, cls: 'text-cr-ok border-cr-ok bg-cr-ok/10' },
  Skipped:   { Icon: CircleSlash, cls: 'text-cr-neutral border-cr-neutral bg-cr-neutral/10' },
  Failed:    { Icon: CircleX,     cls: 'text-cr-critical border-cr-critical bg-cr-critical/10' },
  Pending:   { Icon: Clock,       cls: 'text-cr-info border-cr-info bg-cr-info/10' },   // Clock is STATIC — no spin
}

interface ForwardStatusBadgeProps {
  status: ForwardStatus | string
  className?: string
}

export function ForwardStatusBadge({ status, className }: ForwardStatusBadgeProps) {
  const cfg = CONFIGS[status as ForwardStatus] ?? CONFIGS.Pending
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-control border px-1.5 py-0.5',
        'font-mono text-2xs font-medium',
        cfg.cls,
        className,
      )}
    >
      <cfg.Icon size={12} strokeWidth={1.75} aria-hidden />
      {status}
    </span>
  )
}
