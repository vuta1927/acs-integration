import { NavLink } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, History, Settings, AlertCircle, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BridgeStatusDto } from '@/lib/types'

export function TopNav() {
  const qc = useQueryClient()
  const failedCount =
    qc.getQueryData<BridgeStatusDto>(['status'])?.counters.totalFailed ?? 0

  const navItemCls = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-1.5 rounded-control px-3 py-1 text-xs font-medium transition-colors',
      isActive
        ? 'border-b-2 border-cr-info text-cr-info'
        : 'text-cr-muted hover:text-cr-text',
    )

  return (
    <nav
      className="flex h-9 items-center gap-1 border-b border-cr-border bg-cr-bg px-4"
      aria-label="Main navigation"
    >
      <NavLink to="/" end className={navItemCls}>
        <LayoutDashboard size={14} strokeWidth={1.75} aria-hidden />
        Dashboard
      </NavLink>

      <NavLink to="/history" className={navItemCls}>
        <History size={14} strokeWidth={1.75} aria-hidden />
        History
      </NavLink>

      <NavLink to="/errors" className={navItemCls}>
        <AlertCircle size={14} strokeWidth={1.75} aria-hidden />
        Errors
        {failedCount > 0 && (
          <span className="ml-0.5 min-w-[1.25rem] rounded-full bg-cr-critical px-1 py-0.5 text-center font-mono text-2xs font-semibold leading-none text-cr-bg">
            {failedCount > 99 ? '99+' : failedCount}
          </span>
        )}
      </NavLink>

      <NavLink to="/console" className={navItemCls}>
        <Terminal size={14} strokeWidth={1.75} aria-hidden />
        Console
      </NavLink>

      <NavLink to="/config" className={navItemCls}>
        <Settings size={14} strokeWidth={1.75} aria-hidden />
        Configuration
      </NavLink>
    </nav>
  )
}
