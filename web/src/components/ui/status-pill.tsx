import { PlugZap, LoaderCircle, OctagonAlert, Plug } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ConnectionState } from '@/lib/types'

interface StatusPillProps {
  state: ConnectionState
  compact?: boolean
  className?: string
}

function stateConfig(state: ConnectionState) {
  switch (state) {
    case 'Connected':
      return { label: 'Connected', color: 'text-cr-ok border-cr-ok', bg: 'bg-cr-ok/10', Icon: PlugZap, pulse: true }
    case 'Connecting':
      return { label: 'Connecting', color: 'text-cr-warn border-cr-warn', bg: 'bg-cr-warn/10', Icon: LoaderCircle, spin: true }
    case 'Reconnecting':
      return { label: 'Reconnecting', color: 'text-cr-warn border-cr-warn', bg: 'bg-cr-warn/10', Icon: LoaderCircle, spin: true }
    case 'Error':
      return { label: 'Error', color: 'text-cr-critical border-cr-critical', bg: 'bg-cr-critical/10', Icon: OctagonAlert, glow: true }
    default:
      return { label: state || 'Disconnected', color: 'text-cr-neutral border-cr-neutral', bg: 'bg-cr-neutral/10', Icon: Plug }
  }
}

export function StatusPill({ state, compact, className }: StatusPillProps) {
  const { label, color, bg, Icon, pulse, spin, glow } = stateConfig(state)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-control border px-2 py-0.5',
        color, bg,
        glow && 'shadow-[0_0_0_1px_var(--cr-critical-strong),0_0_16px_rgba(220,38,38,.35)]',
        compact ? 'text-2xs' : 'text-xs',
        className,
      )}
    >
      {/* Live dot for Connected state */}
      {pulse && (
        <span className="cr-live-dot inline-block h-1.5 w-1.5 rounded-full bg-cr-ok animate-cr-pulse" />
      )}
      <Icon
        size={14}
        strokeWidth={1.75}
        className={cn(spin && 'animate-spin')}
        aria-hidden
      />
      {!compact && <span className="font-medium">{label}</span>}
    </span>
  )
}
