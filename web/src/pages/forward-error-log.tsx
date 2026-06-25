import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { eventsApi } from '@/lib/api'
import { JsonViewer } from '@/components/ui/json-viewer'
import { formatTs } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { EventFilters, ForwardedMessageDto } from '@/lib/types'

const PAGE_SIZE = 25

// ── Forwarded-error detail (loaded on demand when row is expanded) ───────────
function ForwardErrorDetail({ eventId }: { eventId: string }) {
  const { data = [], isLoading } = useQuery<ForwardedMessageDto[]>({
    queryKey: ['events', eventId, 'forwarded'],
    queryFn: () => eventsApi.forwarded(eventId),
    staleTime: 30_000,
  })

  if (isLoading) {
    return <p className="py-3 text-center text-xs text-cr-dim">Loading...</p>
  }

  const failures = data.filter(f => f.status === 'Failed')

  if (failures.length === 0) {
    return <p className="py-3 text-center text-xs text-cr-dim">No failed attempts recorded.</p>
  }

  return (
    <div className="space-y-2 p-3">
      {failures.map(f => (
        <div
          key={f.id}
          className="rounded-control border border-cr-critical/30 bg-cr-bg-deep p-3 space-y-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5 min-w-0">
              <AlertCircle size={13} className="mt-0.5 shrink-0 text-cr-critical" />
              <span className="break-all font-mono text-xs text-cr-critical">
                {f.error ?? 'Unknown error'}
              </span>
            </div>
            <span className="shrink-0 font-mono text-2xs text-cr-dim">
              {formatTs(f.forwardedAt, { timeOnly: true })}
            </span>
          </div>

          <div className="flex flex-wrap gap-4 text-2xs text-cr-muted">
            <span>
              Exchange:{' '}
              <span className="font-mono text-cr-text">{f.exchange}</span>
            </span>
            <span>
              Routing key:{' '}
              <span className="font-mono text-cr-info">{f.routingKey}</span>
            </span>
            <span>
              Command ID:{' '}
              <span className="font-mono text-cr-dim">{f.commandId}</span>
            </span>
          </div>

          <div>
            <p className="mb-1 text-2xs text-cr-muted">Payload</p>
            <JsonViewer value={f.payload} className="max-h-40" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Forward Error Log page ───────────────────────────────────────────────────
export default function ForwardErrorLog() {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filters, setFilters] = useState<EventFilters>({
    forwardStatus: 'Failed',
    page: 1,
    pageSize: PAGE_SIZE,
  })

  const set = (patch: Partial<EventFilters>) =>
    setFilters(f => ({ ...f, ...patch, page: 1 }))

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['events', filters],
    queryFn: () => eventsApi.list(filters),
    placeholderData: prev => prev,
  })

  const items = data?.items ?? []
  const total = data?.totalCount ?? 0
  const page  = filters.page ?? 1
  const hasMore = data?.hasMore ?? false

  const hasFilters = !!(filters.eventType || filters.from || filters.to || filters.q)

  return (
    <div className="flex h-[calc(100vh-5.25rem)] flex-col">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-cr-border bg-cr-bg px-4 py-2">
        <input
          type="text"
          placeholder="Search..."
          value={filters.q ?? ''}
          onChange={e => set({ q: e.target.value || undefined })}
          className="w-36 rounded-control border border-cr-border bg-cr-bg-deep px-3 py-1.5 text-xs text-cr-text placeholder:text-cr-dim focus:outline-none focus:ring-1 focus:ring-cr-info"
        />

        <select
          value={filters.eventType ?? ''}
          onChange={e => set({ eventType: e.target.value || undefined })}
          className="rounded-control border border-cr-border bg-cr-bg-deep px-2 py-1.5 text-xs text-cr-text focus:outline-none focus:ring-1 focus:ring-cr-info"
        >
          <option value="">All types</option>
          {['AccessGranted','AccessDenied','DoorForced','DoorHeld','DoorStatusChange','Alarm','Fire'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <input
          type="datetime-local"
          value={filters.from ?? ''}
          onChange={e => set({ from: e.target.value || undefined })}
          className="rounded-control border border-cr-border bg-cr-bg-deep px-2 py-1.5 text-xs text-cr-text focus:outline-none focus:ring-1 focus:ring-cr-info"
          title="From"
        />
        <input
          type="datetime-local"
          value={filters.to ?? ''}
          onChange={e => set({ to: e.target.value || undefined })}
          className="rounded-control border border-cr-border bg-cr-bg-deep px-2 py-1.5 text-xs text-cr-text focus:outline-none focus:ring-1 focus:ring-cr-info"
          title="To"
        />

        {hasFilters && (
          <button
            onClick={() => setFilters({ forwardStatus: 'Failed', page: 1, pageSize: PAGE_SIZE })}
            className="text-xs text-cr-muted hover:text-cr-text"
          >
            Reset
          </button>
        )}

        <span className="font-mono text-2xs text-cr-dim">{total.toLocaleString()} failures</span>

        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="ml-auto inline-flex items-center gap-1 text-xs text-cr-muted hover:text-cr-text disabled:opacity-40"
        >
          <RefreshCw size={12} className={cn(isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Table + expandable rows */}
      <div className="flex-1 overflow-auto">
        {items.length === 0 && !isFetching ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            <span className="text-cr-ok text-3xl">✓</span>
            <p className="text-xs text-cr-muted">No forward errors{hasFilters ? ' matching filters' : ''}.</p>
          </div>
        ) : (
          <table className="w-full min-w-[640px]">
            <thead className="sticky top-0 z-10 bg-cr-bg-deep">
              <tr className="border-b border-cr-border text-left">
                <th className="w-6 px-2 py-2" />
                {['Received', 'Type', 'Code', 'Door', 'Location', 'Alarm'].map(h => (
                  <th key={h} className="px-3 py-2 text-2xs font-medium uppercase tracking-wide text-cr-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(row => {
                const isExpanded = expandedId === row.id
                return (
                  <>
                    <tr
                      key={`row-${row.id}`}
                      onClick={() => setExpandedId(isExpanded ? null : row.id)}
                      className={cn(
                        'cursor-pointer border-b border-cr-border-subtle text-xs transition-colors hover:bg-cr-panel-raised',
                        isExpanded && 'bg-cr-panel',
                        row.isAlarm && 'border-l-2 border-l-cr-critical',
                      )}
                    >
                      <td className="px-2 py-2 text-cr-muted">
                        {isExpanded
                          ? <ChevronDown size={13} strokeWidth={1.75} />
                          : <ChevronRight size={13} strokeWidth={1.75} />}
                      </td>
                      <td className="px-3 py-2 font-mono text-cr-muted">{formatTs(row.receivedAt)}</td>
                      <td className="px-3 py-2 font-mono text-cr-text">{row.eventType}</td>
                      <td className="px-3 py-2 font-mono text-cr-muted">{row.eventCode}</td>
                      <td className="px-3 py-2 text-cr-muted">{row.doorId ?? '—'}</td>
                      <td className="px-3 py-2 text-cr-muted">{row.location ?? '—'}</td>
                      <td className="px-3 py-2">
                        {row.isAlarm && (
                          <span className="font-mono text-2xs font-semibold text-cr-critical">ALARM</span>
                        )}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={`detail-${row.id}`} className="border-b border-cr-border-subtle bg-cr-bg-deep">
                        <td />
                        <td colSpan={6} className="pb-2 pr-4">
                          <ForwardErrorDetail eventId={row.eventId} />
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pager */}
      <div className="flex items-center gap-3 border-t border-cr-border px-4 py-2 text-xs text-cr-muted">
        <button
          onClick={() => setFilters(f => ({ ...f, page: Math.max(1, (f.page ?? 1) - 1) }))}
          disabled={page <= 1}
          className="disabled:opacity-40 hover:text-cr-text"
        >
          &#8592; Newer
        </button>
        <span className="font-mono text-cr-dim">
          Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
        </span>
        <button
          onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}
          disabled={!hasMore}
          className="disabled:opacity-40 hover:text-cr-text"
        >
          Older &#8594;
        </button>
      </div>
    </div>
  )
}
