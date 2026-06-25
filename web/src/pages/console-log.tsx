import { useState, useEffect, useRef, useCallback } from 'react'
import { Pause, Play, Trash2, RefreshCw, Wifi } from 'lucide-react'
import { getConnection } from '@/lib/signalr'
import { logsApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { LogEntryDto, LogLevel } from '@/lib/types'

const MAX_ENTRIES = 500

const LEVEL_TEXT: Record<LogLevel, string> = {
  Trace:       'text-cr-dim',
  Debug:       'text-cr-dim',
  Information: 'text-cr-text',
  Warning:     'text-yellow-400',
  Error:       'text-cr-critical',
  Critical:    'text-cr-critical font-bold',
}

const LEVEL_BADGE: Record<LogLevel, string> = {
  Trace:       'text-cr-dim',
  Debug:       'text-cr-dim',
  Information: 'text-cr-muted',
  Warning:     'text-yellow-400',
  Error:       'text-cr-critical',
  Critical:    'text-cr-critical font-bold',
}

const LEVEL_ROW_BG: Partial<Record<LogLevel, string>> = {
  Warning:  'bg-yellow-400/5',
  Error:    'bg-cr-critical/5',
  Critical: 'bg-cr-critical/10',
}

const LEVELS: LogLevel[] = ['Information', 'Warning', 'Error', 'Critical']

// "14:23:45.123" — time-only with milliseconds for dense log display
function fmtTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return (
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) +
    '.' + String(d.getMilliseconds()).padStart(3, '0')
  )
}

const LEVEL_ABBR: Record<LogLevel, string> = {
  Trace:       'TRC',
  Debug:       'DBG',
  Information: 'INF',
  Warning:     'WRN',
  Error:       'ERR',
  Critical:    'CRT',
}

// ── Expandable exception block ────────────────────────────────────────────────
function ExceptionBlock({ text }: { text: string }) {
  return (
    <pre className="mt-1 whitespace-pre-wrap break-all rounded-control bg-cr-bg border border-cr-critical/20 px-3 py-2 text-2xs text-cr-critical/80 leading-relaxed">
      {text}
    </pre>
  )
}

// ── Console Log page ──────────────────────────────────────────────────────────
export default function ConsoleLog() {
  const [entries, setEntries]     = useState<LogEntryDto[]>([])
  const [loading, setLoading]     = useState(true)
  const [paused, setPaused]       = useState(false)
  const [levelFilter, setLevel]   = useState<LogLevel | ''>('')
  const [catFilter, setCat]       = useState('')
  const [expandedId, setExpanded] = useState<number | null>(null)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const pausedRef  = useRef(false)
  pausedRef.current = paused

  // ── Initial load ────────────────────────────────────────────────────────────
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const data = await logsApi.recent(200)
      setEntries(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  // ── SignalR live subscription ────────────────────────────────────────────────
  useEffect(() => {
    const conn = getConnection()
    const handler = (entry: LogEntryDto) => {
      if (pausedRef.current) return
      setEntries(prev => {
        const next = [...prev, entry]
        return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next
      })
    }
    conn.on('logEntry', handler)
    return () => { conn.off('logEntry', handler) }
  }, [])

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [entries, paused])

  // ── Filtered view ───────────────────────────────────────────────────────────
  const filtered = entries.filter(e =>
    (!levelFilter || e.level === levelFilter) &&
    (!catFilter   || e.category.toLowerCase().includes(catFilter.toLowerCase()))
  )

  const errorCount = entries.filter(e => e.level === 'Error' || e.level === 'Critical').length

  return (
    <div className="flex h-[calc(100vh-5.25rem)] flex-col">

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-cr-border bg-cr-bg px-4 py-2">

        <select
          value={levelFilter}
          onChange={e => setLevel(e.target.value as LogLevel | '')}
          className="rounded-control border border-cr-border bg-cr-bg-deep px-2 py-1.5 text-xs text-cr-text focus:outline-none focus:ring-1 focus:ring-cr-info"
        >
          <option value="">All levels</option>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        <input
          type="text"
          placeholder="Filter category..."
          value={catFilter}
          onChange={e => setCat(e.target.value)}
          className="w-40 rounded-control border border-cr-border bg-cr-bg-deep px-3 py-1.5 text-xs text-cr-text placeholder:text-cr-dim focus:outline-none focus:ring-1 focus:ring-cr-info"
        />

        {(levelFilter || catFilter) && (
          <button
            onClick={() => { setLevel(''); setCat('') }}
            className="text-xs text-cr-muted hover:text-cr-text"
          >
            Reset
          </button>
        )}

        <span className="font-mono text-2xs text-cr-dim">
          {filtered.length}/{entries.length} entries
          {errorCount > 0 && (
            <span className="ml-2 text-cr-critical">{errorCount} error{errorCount !== 1 ? 's' : ''}</span>
          )}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {paused && (
            <span className="rounded bg-yellow-400/10 px-2 py-0.5 font-mono text-2xs text-yellow-400">
              PAUSED
            </span>
          )}

          <button
            onClick={() => setPaused(p => !p)}
            className="inline-flex items-center gap-1 text-xs text-cr-muted hover:text-cr-text"
          >
            {paused
              ? <><Play    size={12} /> Resume</>
              : <><Pause   size={12} /> Pause</>}
          </button>

          <button
            onClick={() => setEntries([])}
            className="inline-flex items-center gap-1 text-xs text-cr-muted hover:text-cr-text"
            title="Clear log buffer"
          >
            <Trash2 size={12} />
            Clear
          </button>

          <button
            onClick={() => void reload()}
            disabled={loading}
            className="inline-flex items-center gap-1 text-xs text-cr-muted hover:text-cr-text disabled:opacity-40"
          >
            <RefreshCw size={12} className={cn(loading && 'animate-spin')} />
            Reload
          </button>

          <span className="inline-flex items-center gap-1 text-2xs text-cr-ok">
            <Wifi size={11} />
            Live
          </span>
        </div>
      </div>

      {/* ── Log list ── */}
      <div className="flex-1 overflow-auto font-mono text-xs">
        {filtered.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            <p className="text-xs text-cr-muted">
              No log entries{levelFilter || catFilter ? ' matching filter' : ''}.
            </p>
          </div>
        ) : (
          <div>
            {filtered.map(entry => {
              const isExpanded = expandedId === entry.id
              const hasException = !!entry.exception
              return (
                <div key={entry.id}>
                  <div
                    onClick={() => hasException && setExpanded(isExpanded ? null : entry.id)}
                    className={cn(
                      'flex gap-3 border-b border-cr-border-subtle px-4 py-0.5 leading-5',
                      LEVEL_ROW_BG[entry.level],
                      hasException && 'cursor-pointer hover:bg-cr-panel-raised',
                      !hasException && 'hover:bg-cr-panel',
                    )}
                  >
                    {/* Time */}
                    <span className="shrink-0 text-cr-dim">{fmtTime(entry.timestamp)}</span>

                    {/* Level badge */}
                    <span className={cn('w-8 shrink-0 text-right', LEVEL_BADGE[entry.level])}>
                      {LEVEL_ABBR[entry.level]}
                    </span>

                    {/* Category */}
                    <span className="w-36 shrink-0 truncate text-cr-dim" title={entry.category}>
                      {entry.category}
                    </span>

                    {/* Message */}
                    <span className={cn('flex-1 break-all', LEVEL_TEXT[entry.level])}>
                      {entry.message}
                      {hasException && (
                        <span className="ml-1.5 text-cr-dim">
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      )}
                    </span>
                  </div>

                  {isExpanded && entry.exception && (
                    <div className="border-b border-cr-border-subtle px-4 pb-2 pt-1">
                      <ExceptionBlock text={entry.exception} />
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  )
}
