import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { statusApi } from '@/lib/api'
import { StatusPill } from '@/components/ui/status-pill'
import { nowClock } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function CommandBar() {
  const { data } = useQuery({
    queryKey: ['status'],
    queryFn: statusApi.get,
    refetchInterval: 10_000,
  })

  const [clock, setClock] = useState(nowClock)
  useEffect(() => {
    // Clock is information, not decoration — exempt from reduced-motion (design-guidelines sec 5)
    const id = setInterval(() => setClock(nowClock()), 1000)
    return () => clearInterval(id)
  }, [])

  const conn = data?.connection
  const cnt = data?.counters

  const failCount = cnt?.totalFailed ?? 0

  return (
    <header
      className="sticky top-0 z-20 flex h-10 items-center gap-4 border-b border-cr-border bg-cr-bg-deep px-4"
      aria-label="System status bar"
    >
      {/* Brand */}
      <span className="shrink-0 font-sans text-xs font-semibold uppercase tracking-widest text-cr-muted">
        PW&#8594;CCTV&nbsp;BRIDGE
      </span>

      <div className="h-4 w-px bg-cr-border" aria-hidden />

      {/* Connection status pills */}
      <div className="flex items-center gap-2">
        <StatusPill state={conn?.proWatchState ?? ''} compact />
        <span className="text-2xs text-cr-dim">PW</span>
        <StatusPill state={conn?.rabbitState ?? ''} compact />
        <span className="text-2xs text-cr-dim">RMQ</span>
      </div>

      <div className="h-4 w-px bg-cr-border" aria-hidden />

      {/* Throughput counters */}
      <div className="flex items-center gap-4 font-mono text-xs tabular-nums">
        <Counter label="RX" value={cnt?.totalReceived} color="text-cr-info" />
        <Counter label="FWD" value={cnt?.totalForwarded} color="text-cr-ok" />
        <Counter label="SKP" value={cnt?.totalSkipped} color="text-cr-neutral" />
        <Counter
          label="FAIL"
          value={failCount}
          color={failCount > 0 ? 'text-cr-critical' : 'text-cr-neutral'}
          glow={failCount > 0}
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Live clock — cr-clock class exempts it from reduced-motion rule */}
      <time className="cr-clock font-mono text-xs tabular-nums text-cr-muted">{clock}</time>
    </header>
  )
}

function Counter({
  label,
  value,
  color,
  glow,
}: {
  label: string
  value: number | undefined
  color: string
  glow?: boolean
}) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-2xs text-cr-dim">{label}</span>
      <span
        className={cn(
          color,
          glow && 'drop-shadow-[0_0_6px_rgba(239,68,68,.7)]',
        )}
      >
        {value?.toLocaleString() ?? '--'}
      </span>
    </span>
  )
}
