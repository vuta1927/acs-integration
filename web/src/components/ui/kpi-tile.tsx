import { cn } from '@/lib/utils'

interface KpiTileProps {
  label: string
  value: number
  variant?: 'info' | 'ok' | 'neutral' | 'critical'
  hero?: boolean
  className?: string
}

const variantCls = {
  info: 'text-cr-info',
  ok: 'text-cr-ok',
  neutral: 'text-cr-neutral',
  critical: 'text-cr-critical',
}

export function KpiTile({ label, value, variant = 'info', hero, className }: KpiTileProps) {
  const isCriticalGlow = variant === 'critical' && value > 0
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-card border border-cr-border bg-cr-panel px-4 py-3',
        isCriticalGlow && 'shadow-[0_0_0_1px_var(--cr-critical-strong),0_0_16px_rgba(220,38,38,.35)]',
        className,
      )}
    >
      <span className="font-sans text-micro font-medium uppercase tracking-wide text-cr-muted">
        {label}
      </span>
      <span
        className={cn(
          'font-mono font-semibold tabular-nums',
          hero ? 'text-hero' : 'text-kpi',
          variantCls[variant],
        )}
      >
        {value.toLocaleString()}
      </span>
    </div>
  )
}
