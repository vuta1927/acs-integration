import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LoaderCircle, Zap } from 'lucide-react'
import { statusApi, eventsApi, proWatchApi, simulatorApi, configApi } from '@/lib/api'
import { StatusPill } from '@/components/ui/status-pill'
import { KpiTile } from '@/components/ui/kpi-tile'
import { ForwardStatusBadge } from '@/components/ui/forward-status-badge'
import { formatTs, sinceTs } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { ReceivedEventDto, BridgeStatusDto } from '@/lib/types'

// ── Connection card (Pro-Watch) ─────────────────────────────────────────────
function ProWatchCard({
  state, error, subscribed, connectedAt, connecting, onConnect, onDisconnect,
}: {
  state: string; error?: string | null; subscribed?: boolean
  connectedAt?: string | null; connecting?: boolean
  onConnect: () => void; onDisconnect: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-cr-border bg-cr-panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-cr-muted">Pro-Watch (SAC)</span>
        <StatusPill state={state} />
      </div>
      <div className="flex items-center gap-1.5">
        <span className={cn('inline-block h-1.5 w-1.5 rounded-full', subscribed ? 'bg-cr-info' : 'bg-cr-neutral')} />
        <span className="text-2xs text-cr-muted">{subscribed ? 'Subscribed' : 'Not subscribed'}</span>
      </div>
      {connectedAt && (
        <p className="font-mono text-2xs text-cr-muted">Since {sinceTs(connectedAt)}</p>
      )}
      {error && <p className="break-all font-mono text-2xs text-cr-critical">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onConnect}
          disabled={connecting || state === 'Connected' || state === 'Connecting'}
          className="inline-flex items-center gap-1.5 rounded-control border border-cr-info/40 bg-cr-info/10 px-3 py-1.5 text-xs text-cr-info hover:bg-cr-info/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {connecting && <LoaderCircle size={12} className="animate-spin" />}
          Connect
        </button>
        <button
          onClick={onDisconnect}
          disabled={state !== 'Connected' && state !== 'Reconnecting'}
          className="inline-flex items-center gap-1.5 rounded-control border border-cr-border bg-cr-panel px-3 py-1.5 text-xs text-cr-muted hover:text-cr-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          Disconnect
        </button>
      </div>
    </div>
  )
}

// ── Rabbit card with inline Test ────────────────────────────────────────────
function RabbitCard({ state, error }: { state: string; error?: string | null }) {
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'err'>('idle')
  const [testError, setTestError] = useState<string | null>(null)

  const handleTest = async () => {
    setTestState('testing')
    setTestError(null)
    try {
      const r = await configApi.testRabbit()
      if (r.success) {
        setTestState('ok')
        toast.success('RabbitMQ connection OK')
        setTimeout(() => setTestState('idle'), 4000)
      } else {
        setTestState('err')
        setTestError(r.error ?? 'Failed')
        toast.error(`RabbitMQ test failed: ${r.error}`, { duration: 7000 })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed'
      setTestState('err')
      setTestError(msg)
      toast.error(`RabbitMQ test error: ${msg}`, { duration: 7000 })
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-cr-border bg-cr-panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-cr-muted">RabbitMQ (CCTV)</span>
        <StatusPill state={state} />
      </div>
      {error && <p className="break-all font-mono text-2xs text-cr-critical">{error}</p>}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleTest}
          disabled={testState === 'testing'}
          aria-busy={testState === 'testing'}
          className="inline-flex items-center gap-1.5 rounded-control border border-cr-border bg-cr-panel px-3 py-1.5 text-xs text-cr-muted hover:text-cr-text disabled:opacity-40"
        >
          {testState === 'testing' && <LoaderCircle size={12} className="animate-spin" />}
          {testState === 'testing' ? 'Testing...' : 'Test connection'}
        </button>
        {testState === 'ok' && <span className="text-xs text-cr-ok">Connection OK</span>}
        {testState === 'err' && (
          <span className="break-all font-mono text-xs text-cr-critical">{testError}</span>
        )}
      </div>
    </div>
  )
}

// ── Live feed row ───────────────────────────────────────────────────────────
function FeedRow({ row }: { row: ReceivedEventDto }) {
  return (
    <tr
      id={`feed-row-${row.id}`}
      className={cn(
        'border-b border-cr-border-subtle text-xs transition-colors hover:bg-cr-panel-raised',
        row.isAlarm && 'border-l-2 border-l-cr-critical',
      )}
    >
      <td className="px-3 py-2 font-mono text-cr-muted">{formatTs(row.receivedAt, { timeOnly: true })}</td>
      <td className="px-3 py-2 font-mono text-cr-text">{row.eventType}</td>
      <td className="px-3 py-2 font-mono text-cr-muted">{row.eventCode}</td>
      <td className="px-3 py-2 text-cr-muted">{row.doorId ?? '—'}</td>
      <td className="px-3 py-2 text-cr-muted">{row.location ?? '—'}</td>
      <td className="px-3 py-2">
        {row.isAlarm && (
          <span className="font-mono text-2xs font-semibold text-cr-critical">ALARM</span>
        )}
      </td>
      <td className="px-3 py-2">
        <ForwardStatusBadge status={row.forwardStatus} />
      </td>
    </tr>
  )
}

// ── Operations Wall page ────────────────────────────────────────────────────
export default function OperationsWall() {
  const qc = useQueryClient()

  const { data: status } = useQuery<BridgeStatusDto>({
    queryKey: ['status'],
    queryFn: statusApi.get,
    refetchInterval: 10_000,
  })
  const { data: feed = [] } = useQuery<ReceivedEventDto[]>({
    queryKey: ['events', 'recent'],
    queryFn: () => eventsApi.recent(50),
    staleTime: 0,
  })
  const { data: scenarios = [] } = useQuery({
    queryKey: ['simulator', 'scenarios'],
    queryFn: simulatorApi.scenarios,
    staleTime: 60_000,
  })

  const connectMut = useMutation({
    mutationFn: proWatchApi.connect,
    onSuccess: () => toast.info('Connecting to Pro-Watch...'),
    onError: (e: Error) => toast.error(`Connect failed: ${e.message}`, { duration: 7000 }),
  })
  const disconnectMut = useMutation({
    mutationFn: proWatchApi.disconnect,
    onSuccess: () => {
      toast.info('Disconnected')
      void qc.invalidateQueries({ queryKey: ['status'] })
    },
    onError: (e: Error) => toast.error(`Disconnect failed: ${e.message}`, { duration: 7000 }),
  })
  const emitMut = useMutation({
    mutationFn: simulatorApi.emit,
    onSuccess: () => toast.success('Scenario emitted'),
    onError: (e: Error) => toast.error(`Emit failed: ${e.message}`, { duration: 7000 }),
  })

  const conn = status?.connection
  const cnt  = status?.counters

  return (
    <div className="space-y-4 p-4">
      {/* Connection cards + hero counter */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ProWatchCard
          state={conn?.proWatchState ?? ''}
          error={conn?.proWatchError}
          subscribed={conn?.subscribed}
          connectedAt={conn?.proWatchConnectedAt}
          connecting={connectMut.isPending}
          onConnect={() => connectMut.mutate()}
          onDisconnect={() => disconnectMut.mutate()}
        />
        <RabbitCard state={conn?.rabbitState ?? ''} error={conn?.rabbitError} />
        <KpiTile label="Total Received" value={cnt?.totalReceived ?? 0} variant="info" hero />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-1">
          <KpiTile label="Forwarded" value={cnt?.totalForwarded ?? 0} variant="ok" />
          <KpiTile label="Skipped"   value={cnt?.totalSkipped   ?? 0} variant="neutral" />
          <KpiTile label="Failed"    value={cnt?.totalFailed    ?? 0} variant="critical" />
        </div>
      </div>

      {/* Simulate chips */}
      {scenarios.length > 0 && (
        <div className="rounded-card border border-cr-border bg-cr-panel p-3">
          <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-cr-muted">
            Simulate scenario
          </p>
          <div className="flex flex-wrap gap-2">
            {scenarios.map(s => (
              <button
                key={s.key}
                onClick={() => emitMut.mutate(s.key)}
                disabled={emitMut.isPending}
                className={cn(
                  'inline-flex items-center gap-1 rounded-control border px-2.5 py-1 text-2xs font-medium transition-colors',
                  s.isAlarm
                    ? 'border-cr-critical/40 text-cr-critical hover:bg-cr-critical/10'
                    : 'border-cr-border text-cr-muted hover:bg-cr-panel-raised hover:text-cr-text',
                )}
              >
                <Zap size={11} aria-hidden />
                {s.key}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Live feed */}
      <div className="rounded-card border border-cr-border bg-cr-panel">
        <div className="flex items-center justify-between border-b border-cr-border-subtle px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-cr-muted">
            Live feed — last {feed.length} events
          </span>
          <span className="flex items-center gap-1 text-2xs text-cr-muted">
            <span className="cr-live-dot inline-block h-1.5 w-1.5 rounded-full bg-cr-ok animate-cr-pulse" />
            Live
          </span>
        </div>

        {feed.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-cr-dim">No events yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-cr-border bg-cr-bg-deep text-left">
                  {['Time', 'Type', 'Code', 'Door', 'Location', 'Alarm', 'Forward'].map(h => (
                    <th key={h} className="px-3 py-2 text-2xs font-medium uppercase tracking-wide text-cr-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {feed.map(row => <FeedRow key={row.id} row={row} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
