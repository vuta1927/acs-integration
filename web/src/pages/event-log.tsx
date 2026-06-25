import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Clipboard, Check, Download, RefreshCw, X } from 'lucide-react'
import { eventsApi } from '@/lib/api'
import { ForwardStatusBadge } from '@/components/ui/forward-status-badge'
import { JsonViewer } from '@/components/ui/json-viewer'
import { formatTs, triggerDownload } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { EventFilters, ReceivedEventDetailDto, ForwardedMessageDto } from '@/lib/types'

const PAGE_SIZE = 25

// ── Filter bar ──────────────────────────────────────────────────────────────
function FilterBar({
  filters, onChange, total,
}: {
  filters: EventFilters
  onChange: (f: EventFilters) => void
  total: number
}) {
  const set = (patch: Partial<EventFilters>) => onChange({ ...filters, ...patch, page: 1 })

  const handleExport = () => {
    toast.info('Preparing export...')
    triggerDownload(eventsApi.exportUrl(filters))
  }

  const hasActive = !!(filters.eventType || filters.isAlarm !== undefined || filters.forwardStatus || filters.from || filters.to || filters.q)

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-cr-border bg-cr-bg px-4 py-2">
      <input
        type="text"
        placeholder="Search..."
        value={filters.q ?? ''}
        onChange={e => set({ q: e.target.value || undefined })}
        className="w-40 rounded-control border border-cr-border bg-cr-bg-deep px-3 py-1.5 text-xs text-cr-text placeholder:text-cr-dim focus:outline-none focus:ring-1 focus:ring-cr-info"
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

      <select
        value={filters.isAlarm === undefined ? '' : String(filters.isAlarm)}
        onChange={e => set({ isAlarm: e.target.value === '' ? undefined : e.target.value === 'true' })}
        className="rounded-control border border-cr-border bg-cr-bg-deep px-2 py-1.5 text-xs text-cr-text focus:outline-none focus:ring-1 focus:ring-cr-info"
      >
        <option value="">All events</option>
        <option value="true">Alarms only</option>
        <option value="false">Non-alarms only</option>
      </select>

      <select
        value={filters.forwardStatus ?? ''}
        onChange={e => set({ forwardStatus: (e.target.value as EventFilters['forwardStatus']) || undefined })}
        className="rounded-control border border-cr-border bg-cr-bg-deep px-2 py-1.5 text-xs text-cr-text focus:outline-none focus:ring-1 focus:ring-cr-info"
      >
        <option value="">All statuses</option>
        {['Pending','Published','Skipped','Failed'].map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {hasActive && (
        <button
          onClick={() => onChange({ page: 1, pageSize: PAGE_SIZE })}
          className="inline-flex items-center gap-1 text-xs text-cr-muted hover:text-cr-text"
        >
          <X size={12} /> Reset
        </button>
      )}

      <span className="font-mono text-2xs text-cr-dim">{total.toLocaleString()} rows</span>

      <div className="ml-auto flex gap-2">
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-control border border-cr-border bg-cr-panel px-3 py-1.5 text-xs text-cr-muted hover:text-cr-text"
        >
          <Download size={13} strokeWidth={1.75} />
          Export JSON
        </button>
      </div>
    </div>
  )
}

// ── Copy helper (inline ✓ feedback) ─────────────────────────────────────────
function CopyButton({ value, label }: { value: unknown; label: string }) {
  const [ok, setOk] = useState(false)
  const handle = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2))
      setOk(true)
      setTimeout(() => setOk(false), 1500)
    } catch {
      toast.error('Clipboard write failed')
    }
  }
  return (
    <button
      onClick={handle}
      className="inline-flex items-center gap-1 text-2xs text-cr-muted transition-colors hover:text-cr-info"
    >
      {ok ? <Check size={11} className="text-cr-ok" /> : <Clipboard size={11} />}
      {label}
    </button>
  )
}

// ── Detail sheet (side panel) ───────────────────────────────────────────────
function DetailSheet({
  event,
  onClose,
}: {
  event: ReceivedEventDetailDto | null
  onClose: () => void
}) {
  const { data: forwarded = [] } = useQuery<ForwardedMessageDto[]>({
    queryKey: ['events', event?.eventId, 'forwarded'],
    queryFn: () => eventsApi.forwarded(event!.eventId),
    enabled: !!event,
  })

  if (!event) return null

  return (
    <aside className="flex w-full flex-col gap-4 overflow-y-auto border-l border-cr-border bg-cr-panel p-4 xl:w-96">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-cr-muted">Event detail</span>
        <button onClick={onClose} className="text-cr-muted hover:text-cr-text" aria-label="Close">
          <X size={15} />
        </button>
      </div>

      <div className="space-y-1">
        <p className="text-2xs text-cr-muted">Event ID</p>
        <p className="break-all font-mono text-xs text-cr-text">{event.eventId}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><p className="text-2xs text-cr-muted">Type</p><p className="font-mono">{event.eventType}</p></div>
        <div><p className="text-2xs text-cr-muted">Code</p><p className="font-mono">{event.eventCode}</p></div>
        <div><p className="text-2xs text-cr-muted">Received</p><p className="font-mono text-2xs">{formatTs(event.receivedAt)}</p></div>
        <div><p className="text-2xs text-cr-muted">Status</p><ForwardStatusBadge status={event.forwardStatus} /></div>
        {event.doorId && <div><p className="text-2xs text-cr-muted">Door</p><p className="font-mono">{event.doorId}</p></div>}
        {event.location && <div><p className="text-2xs text-cr-muted">Location</p><p>{event.location}</p></div>}
        {event.message && <div className="col-span-2"><p className="text-2xs text-cr-muted">Message</p><p className="font-mono text-2xs">{event.message}</p></div>}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-2xs font-medium text-cr-muted">Raw ACS</p>
          <CopyButton value={event.raw} label="Copy" />
        </div>
        <JsonViewer value={event.raw} className="max-h-48" />
      </div>

      {forwarded.length > 0 && (
        <div className="space-y-2">
          <p className="text-2xs font-medium uppercase tracking-wide text-cr-muted">
            Forwarded messages ({forwarded.length})
          </p>
          {forwarded.map(f => (
            <div key={f.id} className="rounded-control border border-cr-border-subtle bg-cr-bg-deep p-3 space-y-1">
              <div className="flex items-center justify-between">
                <ForwardStatusBadge status={f.status} />
                <div className="flex items-center gap-3">
                  <CopyButton value={f.payload} label="Copy CCTV" />
                  <span className="font-mono text-2xs text-cr-dim">{formatTs(f.forwardedAt, { timeOnly: true })}</span>
                </div>
              </div>
              <p className="font-mono text-2xs text-cr-muted">
                {f.exchange} / <span className="text-cr-info">{f.routingKey}</span>
              </p>
              {f.error && <p className="font-mono text-2xs text-cr-critical">{f.error}</p>}
              <JsonViewer value={f.payload} className="max-h-32" />
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}

// ── Event Log page ──────────────────────────────────────────────────────────
export default function EventLog() {
  const [filters, setFilters] = useState<EventFilters>({ page: 1, pageSize: PAGE_SIZE })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const qc = useQueryClient()

  // Quick-copy handlers — check TQ cache first, fetch only if needed
  const copyAcs = async (rowId: number) => {
    try {
      let data = qc.getQueryData<ReceivedEventDetailDto>(['events', rowId, 'detail'])
      if (!data) data = await eventsApi.detail(rowId)
      await navigator.clipboard.writeText(JSON.stringify(data.raw, null, 2))
      toast.success('ACS raw copied')
    } catch {
      toast.error('Failed to copy ACS raw')
    }
  }

  const copyCctv = async (eventId: string) => {
    try {
      let msgs = qc.getQueryData<ForwardedMessageDto[]>(['events', eventId, 'forwarded'])
      if (!msgs) msgs = await eventsApi.forwarded(eventId)
      if (!msgs.length) { toast.info('No forwarded message for this event'); return }
      const payload = msgs.length === 1 ? msgs[0].payload : msgs.map(m => m.payload)
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      toast.success('CCTV payload copied')
    } catch {
      toast.error('Failed to copy CCTV payload')
    }
  }

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['events', filters],
    queryFn: () => eventsApi.list(filters),
    placeholderData: prev => prev,
  })

  const { data: detail } = useQuery<ReceivedEventDetailDto>({
    queryKey: ['events', selectedId, 'detail'],
    queryFn: () => eventsApi.detail(selectedId!),
    enabled: selectedId !== null,
  })

  const items = data?.items ?? []
  const total = data?.totalCount ?? 0
  const page  = filters.page ?? 1
  const hasMore = data?.hasMore ?? false

  return (
    <div className="flex h-[calc(100vh-5.25rem)] flex-col">
      <FilterBar filters={filters} onChange={setFilters} total={total} />

      <div className="flex flex-1 overflow-hidden">
        {/* Table */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="w-full min-w-[700px]">
              <thead className="sticky top-0 z-10 bg-cr-bg-deep">
                <tr className="border-b border-cr-border text-left">
                  {['Received','Type','Code','Door','Location','Alarm','Forward',''].map(h => (
                    <th key={h} className="px-3 py-2 text-2xs font-medium uppercase tracking-wide text-cr-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !isFetching && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-xs text-cr-dim">No events found</td></tr>
                )}
                {items.map(row => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedId(row.id === selectedId ? null : row.id)}
                    className={cn(
                      'cursor-pointer border-b border-cr-border-subtle text-xs transition-colors hover:bg-cr-panel-raised',
                      row.isAlarm && 'border-l-2 border-l-cr-critical',
                      selectedId === row.id && 'border-l-2 border-l-cr-info bg-cr-panel',
                    )}
                  >
                    <td className="px-3 py-2 font-mono text-cr-muted">{formatTs(row.receivedAt)}</td>
                    <td className="px-3 py-2 font-mono text-cr-text">{row.eventType}</td>
                    <td className="px-3 py-2 font-mono text-cr-muted">{row.eventCode}</td>
                    <td className="px-3 py-2 text-cr-muted">{row.doorId ?? '—'}</td>
                    <td className="px-3 py-2 text-cr-muted">{row.location ?? '—'}</td>
                    <td className="px-3 py-2">
                      {row.isAlarm && <span className="font-mono text-2xs font-semibold text-cr-critical">ALARM</span>}
                    </td>
                    <td className="px-3 py-2"><ForwardStatusBadge status={row.forwardStatus} /></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={e => { e.stopPropagation(); void copyAcs(row.id) }}
                          className="inline-flex items-center gap-1 text-2xs text-cr-muted transition-colors hover:text-cr-info"
                          title="Copy ACS raw JSON"
                        >
                          <Clipboard size={11} />
                          ACS
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); void copyCctv(row.eventId) }}
                          className="inline-flex items-center gap-1 text-2xs text-cr-muted transition-colors hover:text-cr-info"
                          title="Copy CCTV forwarded payload"
                        >
                          <Clipboard size={11} />
                          CCTV
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedId(row.id) }}
                          className="text-2xs text-cr-info hover:underline"
                          aria-label={`Details for event ${row.id}`}
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            <span className="font-mono text-cr-dim">Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
            <button
              onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}
              disabled={!hasMore}
              className="disabled:opacity-40 hover:text-cr-text"
            >
              Older &#8594;
            </button>
            <button
              onClick={() => void refetch()}
              disabled={isFetching}
              className="ml-auto inline-flex items-center gap-1 hover:text-cr-text disabled:opacity-40"
            >
              <RefreshCw size={12} className={cn(isFetching && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* Detail sheet */}
        {selectedId !== null && (
          <DetailSheet
            event={detail ?? null}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  )
}
